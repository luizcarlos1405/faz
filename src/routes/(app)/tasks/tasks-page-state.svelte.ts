import {
  getVisibleTasks,
  getDoneToday,
  createTask,
  completeTask,
  uncompleteTask,
  removeTask as deleteTask,
  updateTask,
  getTask,
  reorderTasks,
  restoreTask,
  getNextTaskForGoals,
  rescheduleTask,
  deferTask,
} from '$lib/db/task-repo';
import { createGoal, getGoal, getAllGoals, recalcGoalStatus } from '$lib/db/goal-repo';
import { createCare, getCare, markPlanDone } from '$lib/db/care-repo';
import { isGoalPaused } from '$lib/engines/goal-engine';
import { describeRecurrence } from '$lib/engines/recurrence-wizard';
import { DOC_TYPE, TASK_STATUS, type OriginInfo, type TaskDoc } from '$lib/types';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { bumpClock, getNow, getTaskRefreshVersion } from '$lib/scheduler-refresh.svelte';
import {
  doAfterFromTime,
  partitionDeferred,
  withDoAfter,
  withDoAt,
} from '$lib/engines/defer-engine';
import { formatClock, formatWeekdayDate } from '$lib/utils/format-date';
import { Temporal } from '@js-temporal/polyfill';
import { getToastState } from '$lib/components/toast-state.svelte';
import { reorderItems } from '$lib/utils/reorderItems';
import { snapshotTask } from '$lib/utils/task-undo';

function getToday(): string {
  return Temporal.Now.plainDateISO().toString();
}

export function getTasksPageState() {
  let allTasks = $state<TaskDoc[]>([]);
  let displayedTasks = $state<TaskDoc[]>([]);
  let doneTodayList = $state<TaskDoc[]>([]);
  let originTitles = new SvelteMap<string, string>();
  let planPhrases = new SvelteMap<string, string>();
  let newTitle = $state('');
  let loading = $state(true);
  let editingTask = $state<TaskDoc | null>(null);
  const toast = getToastState();

  const partition = $derived(partitionDeferred(displayedTasks, getNow()));

  $effect(() => {
    getTaskRefreshVersion();
    load();
  });

  async function load() {
    bumpClock();
    const today = getToday();
    [allTasks, doneTodayList] = await Promise.all([getVisibleTasks(today), getDoneToday(today)]);

    const pausedGoalIds = new SvelteSet(
      (await getAllGoals()).filter(isGoalPaused).map((g) => g._id),
    );

    const goalIds = [
      ...new SvelteSet(
        allTasks.filter((t) => t.goalId && !pausedGoalIds.has(t.goalId)).map((t) => t.goalId!),
      ),
    ];
    const topTaskPerGoal =
      goalIds.length > 0 ? await getNextTaskForGoals(goalIds) : new SvelteMap<string, TaskDoc>();

    const visibleGoalTaskIds = new SvelteSet<string>();
    for (const topTask of topTaskPerGoal.values()) {
      if (topTask.doAt <= today) {
        visibleGoalTaskIds.add(topTask._id);
      }
    }

    displayedTasks = allTasks.filter((t) => !t.goalId || visibleGoalTaskIds.has(t._id));

    await loadOrigins();
    loading = false;
  }

  async function loadOrigins() {
    const allDocs = [...allTasks, ...doneTodayList];
    const ids = new SvelteSet<string>();
    for (const t of allDocs) {
      if (t.goalId) ids.add(t.goalId);
      if (t.careId) ids.add(t.careId);
    }
    const docs = await Promise.all(
      [...ids].map(async (id) => {
        try {
          if (id.startsWith(DOC_TYPE.GOAL.idPrefix)) {
            return await getGoal(id);
          }
          if (id.startsWith(DOC_TYPE.CARE.idPrefix)) {
            return await getCare(id);
          }
        } catch {
          return undefined;
        }
        return undefined;
      }),
    );
    const titles = new SvelteMap<string, string>();
    const phrases = new SvelteMap<string, string>();
    for (const doc of docs) {
      if (!doc) continue;
      titles.set(doc._id, doc.title);
      if (doc.type === DOC_TYPE.CARE.value) {
        for (const tp of doc.taskPlans) {
          phrases.set(tp._id, describeRecurrence(tp.recurrence));
        }
      }
    }
    originTitles = titles;
    planPhrases = phrases;
  }

  function getOriginInfo(task: TaskDoc): OriginInfo | null {
    if (task.goalId) {
      const title = originTitles.get(task.goalId);
      if (title) return { type: 'goal', id: task.goalId, title };
    }
    if (task.careId) {
      const title = originTitles.get(task.careId);
      if (title) {
        const recurrence = task.taskPlanId ? planPhrases.get(task.taskPlanId) : undefined;
        return recurrence
          ? { type: 'care', id: task.careId, title, recurrence }
          : { type: 'care', id: task.careId, title };
      }
    }
    return null;
  }

  async function add(): Promise<string | undefined> {
    const title = newTitle.trim();
    if (!title) return undefined;
    const created = await createTask({ title, doAt: getToday() });
    newTitle = '';
    await load();
    return created._id;
  }

  async function toggleComplete(id: string) {
    const task = allTasks.find((t) => t._id === id) || doneTodayList.find((t) => t._id === id);
    if (!task) return;
    if (task.status === TASK_STATUS.TODO.value) {
      await completeTask(id);
      if (task.taskPlanId) {
        await markPlanDone(task.taskPlanId, getToday());
      }
      if (task.goalId) {
        await recalcGoalStatus(task.goalId);
      }
    } else {
      await uncompleteTask(id);
      if (task.goalId) {
        await recalcGoalStatus(task.goalId);
      }
    }
    await load();
  }

  async function postponeTask(id: string, targetDate?: string) {
    let fresh: TaskDoc;
    try {
      fresh = await getTask(id);
    } catch {
      await load();
      return;
    }

    const originalDoAt = fresh.doAt;
    const originalDoAfter = fresh.doAfter;
    const today = Temporal.PlainDate.from(getToday());
    const tomorrow = today.add({ days: 1 }).toString();
    const doAt = targetDate ?? tomorrow;

    await rescheduleTask(id, doAt);
    await load();

    const message =
      doAt === tomorrow ? 'Postponed to tomorrow' : `Moved to ${formatWeekdayDate(doAt, today)}`;
    toast.notify(message, {
      label: 'Undo',
      fn: async () => {
        const current = await getTask(id);
        if (current) {
          current.doAt = originalDoAt;
          await updateTask(withDoAfter(current, originalDoAfter));
          await load();
        }
      },
    });
  }

  async function deferUntil(id: string, hour: number, minute: number) {
    let fresh: TaskDoc;
    try {
      fresh = await getTask(id);
    } catch {
      await load();
      return;
    }

    const originalDoAfter = fresh.doAfter;
    const doAfter = doAfterFromTime(
      Temporal.PlainDate.from(getToday()),
      hour,
      minute,
      Temporal.Now.timeZoneId(),
    );

    await deferTask(id, doAfter);
    await load();

    toast.notify(`Hidden until ${formatClock(hour, minute)}`, {
      label: 'Undo',
      fn: async () => {
        await deferTask(id, originalDoAfter ?? null);
        await load();
      },
    });
  }

  async function clearDoAfter(id: string) {
    await deferTask(id, null);
    await load();
  }

  async function removeTask(id: string) {
    const task = allTasks.find((t) => t._id === id) || doneTodayList.find((t) => t._id === id);
    if (!task) return;

    const backup = snapshotTask(task);

    await deleteTask(id);
    editingTask = null;
    await load();

    toast.notify('Task removed', {
      label: 'Undo',
      fn: async () => {
        await restoreTask(backup);
        await load();
      },
    });
  }

  function openEdit(taskId: string) {
    const task =
      allTasks.find((t) => t._id === taskId) || doneTodayList.find((t) => t._id === taskId);
    if (task) editingTask = { ...task };
  }

  function closeEdit() {
    editingTask = null;
  }

  async function saveEdit(title: string, doAt: string, doAfter?: string | null) {
    if (!editingTask) return;
    const task = await getTask(editingTask._id);
    task.title = title.trim();
    let next = withDoAt(task, doAt);
    if (doAfter !== undefined) next = withDoAfter(next, doAfter);
    await updateTask(next);
    editingTask = null;
    await load();
  }

  async function transformToGoal() {
    if (!editingTask) return;
    const task = await getTask(editingTask._id);
    const backup = snapshotTask(task);
    await createGoal(task.title);
    await deleteTask(task._id);
    editingTask = null;
    await load();
    toast.notify('Converted to goal', {
      label: 'Undo',
      fn: async () => {
        await restoreTask(backup);
        await load();
      },
    });
  }

  async function transformToCare() {
    if (!editingTask) return;
    const task = await getTask(editingTask._id);
    const backup = snapshotTask(task);
    await createCare(task.title, []);
    await deleteTask(task._id);
    editingTask = null;
    await load();
    toast.notify('Converted to care', {
      label: 'Undo',
      fn: async () => {
        await restoreTask(backup);
        await load();
      },
    });
  }

  function reorder(fromIndex: number, toIndex: number) {
    const ready = reorderItems(partition.ready, fromIndex, toIndex, (item, i) => {
      item.tasksListOrder = i;
    });
    displayedTasks = [...ready, ...partition.deferred];
  }

  async function persistOrder() {
    const itemIds = partition.ready.map((t) => t._id);
    await reorderTasks(itemIds);
  }

  async function moveToEnd(): Promise<TaskDoc | null> {
    if (partition.ready.length === 0) return null;
    reorder(0, partition.ready.length - 1);
    await persistOrder();
    return partition.ready[0] ?? null;
  }

  return {
    get tasks() {
      return partition.ready;
    },
    get laterTasks() {
      return partition.deferred;
    },
    get doneToday() {
      return doneTodayList;
    },
    get newTitle() {
      return newTitle;
    },
    set newTitle(v: string) {
      newTitle = v;
    },
    get loading() {
      return loading;
    },
    get editingTask() {
      return editingTask;
    },
    load,
    add,
    toggleComplete,
    postponeTask,
    deferUntil,
    clearDoAfter,
    removeTask,
    openEdit,
    closeEdit,
    saveEdit,
    transformToGoal,
    transformToCare,
    reorder,
    persistOrder,
    moveToEnd,
    getOriginInfo,
  };
}
