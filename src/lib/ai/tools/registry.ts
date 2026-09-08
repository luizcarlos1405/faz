import { Temporal } from '@js-temporal/polyfill';
import {
  getTask,
  findTasks,
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  removeTask,
  restoreTask,
  getTasksByGoal,
  updateTasksCareForPlan,
} from '$lib/db/task-repo';
import {
  getGoal,
  getAllGoals,
  createGoal,
  updateGoal,
  removeGoal,
  restoreGoal,
  recalcGoalStatus,
} from '$lib/db/goal-repo';
import {
  getInboxItem,
  getUnprocessed,
  createInboxItem,
  markProcessed,
  updateInboxItem,
} from '$lib/db/inbox-repo';
import {
  getCare,
  getAllCares,
  createCare,
  updateCare,
  removeCare,
  restoreCare,
  addTaskPlan,
  updateTaskPlan,
  removeTaskPlan,
  moveTaskPlan,
  markPlanDone,
} from '$lib/db/care-repo';
import {
  buildRecurrence,
  isValidRecurrence,
  describeRecurrence,
  type WizardRecurrenceInput,
} from '$lib/engines/recurrence-wizard';
import { isAfterDoneRecurrence } from '$lib/engines/care-engine';
import { doAfterFromTime, withDoAfter, withDoAt } from '$lib/engines/defer-engine';
import { runSchedulerNow } from '$lib/scheduler';
import { bumpTaskRefresh } from '$lib/scheduler-refresh.svelte';
import { snapshotTask } from '$lib/utils/task-undo';
import {
  GOAL_STATUS,
  OVERDUE_BEHAVIOR,
  FIXED_DAYS_SUBTYPE,
  type TaskDoc,
  type TaskPlan,
  type OverdueBehavior,
} from '$lib/types';

export interface ToolUndo {
  label: string;
  restore: () => Promise<void>;
}

export interface ToolResult {
  ok: boolean;
  label: string;
  summary: unknown;
  error?: string;
  undo?: ToolUndo;
}

const GOAL_STATUSES = new Set(Object.values(GOAL_STATUS).map((s) => s.value));
const OVERDUE_BEHAVIORS = new Set(Object.values(OVERDUE_BEHAVIOR).map((s) => s.value));
const LIST_LIMIT = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE.test(v);
}

function todayIso(): string {
  return Temporal.Now.plainDateISO().toString();
}

const INVALID = Symbol('invalid');

function validateOverdue(v: unknown): OverdueBehavior | undefined | typeof INVALID {
  const s = str(v);
  if (!s) return undefined;
  return OVERDUE_BEHAVIORS.has(s as OverdueBehavior) ? (s as OverdueBehavior) : INVALID;
}

function recurrenceFromArgs(args: Record<string, any>): WizardRecurrenceInput | null {
  const r = args.recurrence;
  if (!r || typeof r !== 'object') return null;
  const scheduleType = str(r.scheduleType);
  if (!scheduleType) return null;
  const interval =
    r.interval && typeof r.interval === 'object'
      ? (r.interval as WizardRecurrenceInput['interval'])
      : {};
  const daysSubtype = str(r.daysSubtype) || FIXED_DAYS_SUBTYPE.WEEKDAYS.value;
  return {
    scheduleType: scheduleType as WizardRecurrenceInput['scheduleType'],
    interval,
    daysSubtype: daysSubtype as WizardRecurrenceInput['daysSubtype'],
    daysOfWeek: Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [],
    daysOfMonth: Array.isArray(r.daysOfMonth) ? r.daysOfMonth : [],
    yearDates: Array.isArray(r.yearDates) ? r.yearDates : [],
    startDate: isIsoDate(r.startDate) ? r.startDate : '',
  };
}

function ok(label: string, summary: unknown, undo?: ToolUndo): ToolResult {
  return { ok: true, label, summary, undo };
}

function fail(label: string, error: string): ToolResult {
  return { ok: false, label, summary: { error }, error };
}

function taskSummary(t: TaskDoc) {
  return {
    id: t._id,
    title: t.title,
    status: t.status,
    doAt: t.doAt,
    doAfter: t.doAfter,
    goalId: t.goalId,
    careId: t.careId,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(v: unknown): { hour: number; minute: number } | null {
  if (typeof v !== 'string') return null;
  const match = TIME_RE.exec(v.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function doAfterFor(doAt: string, time: { hour: number; minute: number }): string {
  const today = Temporal.Now.plainDateISO();
  const anchor = doAt > today.toString() ? Temporal.PlainDate.from(doAt) : today;
  return doAfterFromTime(anchor, time.hour, time.minute, Temporal.Now.timeZoneId());
}

async function getOrFail<T>(
  label: string,
  id: string,
  fetcher: () => Promise<T>,
): Promise<T | ToolResult> {
  try {
    return await fetcher();
  } catch {
    return fail(label, `No item found with id ${id}.`);
  }
}

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  switch (name) {
    case 'list_tasks': {
      const tasks = await findTasks({
        status: str(args.status) || undefined,
        goalId: str(args.goalId) || undefined,
        dueBefore: isIsoDate(args.dueBefore) ? args.dueBefore : undefined,
      });
      const trimmed = tasks.slice(0, LIST_LIMIT).map(taskSummary);
      return ok(`Read ${tasks.length} task${tasks.length === 1 ? '' : 's'}`, {
        count: tasks.length,
        truncated: tasks.length > LIST_LIMIT,
        tasks: trimmed,
      });
    }

    case 'get_task': {
      const id = str(args.id);
      const found = await getOrFail('Read task', id, () => getTask(id));
      if ('ok' in found) return found;
      return ok(`Read task: ${found.title}`, { task: taskSummary(found) });
    }

    case 'list_goals': {
      const goals = (await getAllGoals()).map((g) => ({
        id: g._id,
        title: g.title,
        status: g.status,
      }));
      return ok(`Read ${goals.length} goal${goals.length === 1 ? '' : 's'}`, { goals });
    }

    case 'get_goal': {
      const id = str(args.id);
      const goal = await getOrFail('Read goal', id, () => getGoal(id));
      if ('ok' in goal) return goal;
      const steps = (await getTasksByGoal(id)).map(taskSummary);
      return ok(`Read goal: ${goal.title}`, {
        goal: { id: goal._id, title: goal.title, status: goal.status },
        steps,
      });
    }

    case 'list_inbox': {
      const items = (await getUnprocessed()).map((i) => ({ id: i._id, title: i.title }));
      return ok(`Read ${items.length} inbox item${items.length === 1 ? '' : 's'}`, { items });
    }

    case 'list_cares': {
      const cares = (await getAllCares()).map((c) => ({
        id: c._id,
        title: c.title,
        planCount: c.taskPlans.length,
      }));
      return ok(`Read ${cares.length} care${cares.length === 1 ? '' : 's'}`, { cares });
    }

    case 'get_care': {
      const id = str(args.id);
      const care = await getOrFail('Read care', id, () => getCare(id));
      if ('ok' in care) return care;
      const plans = care.taskPlans.map((tp) => ({
        id: tp._id,
        title: tp.title,
        schedule: describeRecurrence(tp.recurrence),
      }));
      return ok(`Read care: ${care.title}`, {
        care: { id: care._id, title: care.title },
        plans,
      });
    }

    case 'create_care': {
      const title = str(args.title);
      if (!title) return fail('Create care failed', 'title is required.');
      const originInboxItemId = str(args.originInboxItemId) || undefined;
      const care = await createCare(title, [], originInboxItemId);
      return ok(`Created care: ${title}`, { id: care._id, title });
    }

    case 'update_care': {
      const id = str(args.id);
      const title = str(args.title);
      if (!title) return fail('Update care failed', 'title is required.');
      const care = await getOrFail('Update care', id, () => getCare(id));
      if ('ok' in care) return care;
      care.title = title;
      await updateCare(care);
      return ok(`Renamed care: ${title}`, { id, title });
    }

    case 'delete_care': {
      const id = str(args.id);
      const care = await getOrFail('Delete care', id, () => getCare(id));
      if ('ok' in care) return care;
      await removeCare(id);
      return ok(
        `Deleted care: ${care.title}`,
        { id, deleted: true },
        {
          label: `Restore care: ${care.title}`,
          restore: async () => {
            await restoreCare(care);
          },
        },
      );
    }

    case 'add_task_plan': {
      const careId = str(args.careId);
      const title = str(args.title);
      if (!title) return fail('Add plan failed', 'title is required.');
      const input = recurrenceFromArgs(args);
      if (!input || !isIsoDate(input.startDate) || !isValidRecurrence(input))
        return fail('Add plan failed', 'recurrence is invalid or incomplete.');
      const care = await getOrFail('Add plan', careId, () => getCare(careId));
      if ('ok' in care) return care;
      const recurrence = buildRecurrence(input);
      const overdueBehavior = isAfterDoneRecurrence(recurrence)
        ? OVERDUE_BEHAVIOR.KEEP.value
        : validateOverdue(args.overdueBehavior);
      if (overdueBehavior === INVALID)
        return fail(
          'Add plan failed',
          `Invalid overdueBehavior. Valid: ${[...OVERDUE_BEHAVIORS].join(', ')}.`,
        );
      const updated = await addTaskPlan(careId, { title, recurrence, overdueBehavior });
      await runSchedulerNow();
      bumpTaskRefresh();
      const plan = updated.taskPlans[updated.taskPlans.length - 1];
      return ok(`Added plan: ${title}`, {
        careId,
        planId: plan._id,
        schedule: describeRecurrence(recurrence),
      });
    }

    case 'update_task_plan': {
      const careId = str(args.careId);
      const planId = str(args.planId);
      if (!planId) return fail('Update plan failed', 'planId is required.');
      const care = await getOrFail('Update plan', careId, () => getCare(careId));
      if ('ok' in care) return care;
      if (!care.taskPlans.some((tp) => tp._id === planId))
        return fail('Update plan failed', `No plan ${planId} in care ${careId}.`);
      const existingPlan = care.taskPlans.find((tp) => tp._id === planId)!;
      const updates: Partial<TaskPlan> = {};
      const title = str(args.title);
      if (title) updates.title = title;
      if (args.recurrence !== undefined) {
        const input = recurrenceFromArgs(args);
        if (!input || !isIsoDate(input.startDate) || !isValidRecurrence(input))
          return fail('Update plan failed', 'recurrence is invalid or incomplete.');
        updates.recurrence = buildRecurrence(input);
      }
      if (args.overdueBehavior !== undefined) {
        const effectiveRecurrence = updates.recurrence ?? existingPlan.recurrence;
        const ob = isAfterDoneRecurrence(effectiveRecurrence)
          ? OVERDUE_BEHAVIOR.KEEP.value
          : validateOverdue(args.overdueBehavior);
        if (ob === INVALID)
          return fail(
            'Update plan failed',
            `Invalid overdueBehavior. Valid: ${[...OVERDUE_BEHAVIORS].join(', ')}.`,
          );
        updates.overdueBehavior = ob;
      }
      await updateTaskPlan(careId, planId, updates);
      await runSchedulerNow();
      bumpTaskRefresh();
      return ok(`Updated plan`, { careId, planId });
    }

    case 'delete_task_plan': {
      const careId = str(args.careId);
      const planId = str(args.planId);
      const care = await getOrFail('Delete plan', careId, () => getCare(careId));
      if ('ok' in care) return care;
      const plan = care.taskPlans.find((tp) => tp._id === planId);
      if (!plan) return fail('Delete plan failed', `No plan ${planId} in care ${careId}.`);
      const snapshot: TaskPlan = { ...plan };
      await removeTaskPlan(careId, planId);
      await runSchedulerNow();
      bumpTaskRefresh();
      return ok(
        `Deleted plan: ${plan.title}`,
        { careId, planId, deleted: true },
        {
          label: `Restore plan: ${plan.title}`,
          restore: async () => {
            const cur = await getCare(careId);
            cur.taskPlans.push(snapshot);
            await updateCare(cur);
            await runSchedulerNow();
            bumpTaskRefresh();
          },
        },
      );
    }

    case 'move_task_plan': {
      const planId = str(args.planId);
      const fromCareId = str(args.fromCareId);
      const toCareId = str(args.toCareId);
      if (!planId || !fromCareId || !toCareId)
        return fail('Move plan failed', 'planId, fromCareId, and toCareId are required.');
      if (fromCareId === toCareId)
        return fail('Move plan failed', 'fromCareId and toCareId must differ.');
      const fromCare = await getOrFail('Move plan', fromCareId, () => getCare(fromCareId));
      if ('ok' in fromCare) return fromCare;
      if (!fromCare.taskPlans.some((tp) => tp._id === planId))
        return fail('Move plan failed', `No plan ${planId} in care ${fromCareId}.`);
      await moveTaskPlan(fromCareId, toCareId, planId);
      await updateTasksCareForPlan(planId, toCareId);
      await runSchedulerNow();
      bumpTaskRefresh();
      return ok(`Moved plan to another care`, { planId, fromCareId, toCareId });
    }

    case 'create_task': {
      const title = str(args.title);
      if (!title) return fail('Create task failed', 'title is required.');
      if (!isIsoDate(args.doAt))
        return fail('Create task failed', 'doAt must be an ISO date YYYY-MM-DD.');
      const goalId = str(args.goalId) || undefined;
      const originInboxItemId = str(args.originInboxItemId) || undefined;
      if (args.doAfterTime !== undefined && !parseTime(args.doAfterTime))
        return fail('Create task failed', 'doAfterTime must be HH:MM (24h).');
      const task = await createTask({ title, doAt: args.doAt, goalId, originInboxItemId });
      const time = parseTime(args.doAfterTime);
      if (time) await updateTask(withDoAfter(task, doAfterFor(task.doAt, time)));
      if (goalId)
        await recalcGoalStatus(goalId).catch((e) =>
          console.error('[ai/tools] recalc goal status failed', e),
        );
      return ok(`Created task: ${title}`, { id: task._id, title });
    }

    case 'update_task': {
      const id = str(args.id);
      if (!id) return fail('Update task failed', 'id is required.');
      const task = await getOrFail('Update task', id, () => getTask(id));
      if ('ok' in task) return task;
      const title = str(args.title);
      if (title) task.title = title;
      if (args.doAfterTime !== undefined && !parseTime(args.doAfterTime))
        return fail('Update task failed', 'doAfterTime must be HH:MM (24h).');
      let next = isIsoDate(args.doAt) ? withDoAt(task, args.doAt) : task;
      const time = parseTime(args.doAfterTime);
      if (time) next = withDoAfter(next, doAfterFor(next.doAt, time));
      else if (args.clearDoAfter === true) next = withDoAfter(next, null);
      await updateTask(next);
      return ok(`Updated task: ${next.title}`, { id, title: next.title, doAfter: next.doAfter });
    }

    case 'complete_task': {
      const id = str(args.id);
      const task = await getOrFail('Complete task', id, () => getTask(id));
      if ('ok' in task) return task;
      const done = await completeTask(id);
      if (done.taskPlanId)
        await markPlanDone(done.taskPlanId, todayIso()).catch((e) =>
          console.error('[ai/tools] mark plan done failed', e),
        );
      if (done.goalId)
        await recalcGoalStatus(done.goalId).catch((e) =>
          console.error('[ai/tools] recalc goal status failed', e),
        );
      return ok(`Completed task: ${done.title}`, { id, status: done.status });
    }

    case 'uncomplete_task': {
      const id = str(args.id);
      const task = await getOrFail('Reopen task', id, () => getTask(id));
      if ('ok' in task) return task;
      const reopened = await uncompleteTask(id);
      if (reopened.goalId)
        await recalcGoalStatus(reopened.goalId).catch((e) =>
          console.error('[ai/tools] recalc goal status failed', e),
        );
      return ok(`Reopened task: ${reopened.title}`, { id, status: reopened.status });
    }

    case 'delete_task': {
      const id = str(args.id);
      const task = await getOrFail('Delete task', id, () => getTask(id));
      if ('ok' in task) return task;
      await removeTask(id);
      return ok(
        `Deleted task: ${task.title}`,
        { id, deleted: true },
        {
          label: `Restore task: ${task.title}`,
          restore: async () => {
            await restoreTask(task);
          },
        },
      );
    }

    case 'convert_task_to_goal': {
      const id = str(args.id);
      const task = await getOrFail('Convert task', id, () => getTask(id));
      if ('ok' in task) return task;
      const backup = snapshotTask(task);
      await createGoal(task.title);
      await removeTask(id);
      if (task.goalId) {
        await recalcGoalStatus(task.goalId).catch((e) =>
          console.error('[ai/tools] recalc goal status failed', e),
        );
      }
      return ok(
        `Converted to goal: ${task.title}`,
        { id, converted: 'goal' },
        {
          label: `Restore task: ${task.title}`,
          restore: async () => {
            await restoreTask(backup);
          },
        },
      );
    }

    case 'convert_task_to_care': {
      const id = str(args.id);
      const task = await getOrFail('Convert task', id, () => getTask(id));
      if ('ok' in task) return task;
      const backup = snapshotTask(task);
      await createCare(task.title, []);
      await removeTask(id);
      if (task.goalId) {
        await recalcGoalStatus(task.goalId).catch((e) =>
          console.error('[ai/tools] recalc goal status failed', e),
        );
      }
      return ok(
        `Converted to care: ${task.title}`,
        { id, converted: 'care' },
        {
          label: `Restore task: ${task.title}`,
          restore: async () => {
            await restoreTask(backup);
          },
        },
      );
    }

    case 'create_goal': {
      const title = str(args.title);
      if (!title) return fail('Create goal failed', 'title is required.');
      const originInboxItemId = str(args.originInboxItemId) || undefined;
      const goal = await createGoal(title, originInboxItemId);
      return ok(`Created goal: ${title}`, { id: goal._id, title });
    }

    case 'update_goal': {
      const id = str(args.id);
      if (!id) return fail('Update goal failed', 'id is required.');
      const goal = await getOrFail('Update goal', id, () => getGoal(id));
      if ('ok' in goal) return goal;
      const title = str(args.title);
      if (title) goal.title = title;
      if (args.status !== undefined) {
        if (!GOAL_STATUSES.has(args.status)) {
          return fail(
            'Update goal failed',
            `Invalid status. Valid: ${[...GOAL_STATUSES].join(', ')}.`,
          );
        }
        goal.status = args.status;
      }
      await updateGoal(goal);
      return ok(`Updated goal: ${goal.title}`, { id, title: goal.title });
    }

    case 'delete_goal': {
      const id = str(args.id);
      const goal = await getOrFail('Delete goal', id, () => getGoal(id));
      if ('ok' in goal) return goal;
      await removeGoal(id);
      return ok(
        `Deleted goal: ${goal.title}`,
        { id, deleted: true },
        {
          label: `Restore goal: ${goal.title}`,
          restore: async () => {
            await restoreGoal(goal);
          },
        },
      );
    }

    case 'create_inbox_item': {
      const title = str(args.title);
      if (!title) return fail('Capture inbox failed', 'title is required.');
      const item = await createInboxItem(title);
      return ok(`Captured inbox: ${title}`, { id: item._id, title });
    }

    case 'mark_inbox_processed': {
      const id = str(args.id);
      const item = await getOrFail('Process inbox', id, () => getInboxItem(id));
      if ('ok' in item) return item;
      await markProcessed(id);
      return ok(
        `Processed inbox: ${item.title}`,
        { id, processed: true },
        {
          label: `Restore inbox: ${item.title}`,
          restore: async () => {
            const cur = await getInboxItem(id);
            cur.isProcessed = false;
            await updateInboxItem(cur);
          },
        },
      );
    }

    default:
      return fail('Unknown tool', `No tool named "${name}".`);
  }
}
