import {
  getAllCares,
  createCare,
  removeTaskPlan as removeTaskPlanRepo,
  removeCare as removeCareRepo,
  getCare,
  updateCare,
  updateTaskPlan as updateTaskPlanRepo,
  reorderCares as reorderCaresRepo,
  reorderTaskPlans as reorderTaskPlansRepo,
  moveTaskPlan as moveTaskPlanRepo,
} from '$lib/db/care-repo';
import { updateTasksCareForPlan } from '$lib/db/task-repo';
import { Temporal } from '@js-temporal/polyfill';
import { reorderItems } from '$lib/utils/reorderItems';
import { describeRecurrence } from '$lib/engines/recurrence-wizard';
import type { CareDoc, TaskPlan, Recurrence, OverdueBehavior } from '$lib/types';

import { runSchedulerNow } from '$lib/scheduler';
import { bumpTaskRefresh } from '$lib/scheduler-refresh.svelte';

export { describeRecurrence };

export function getCaresPageState() {
  let cares = $state<CareDoc[]>([]);
  let newTitle = $state('');
  let loading = $state(true);

  async function load() {
    cares = await getAllCares();
    loading = false;
  }

  async function add(): Promise<string | undefined> {
    const title = newTitle.trim();
    if (!title) return undefined;
    const created = await createCare(title, []);
    newTitle = '';
    await load();
    return created._id;
  }

  function reorder(fromIndex: number, toIndex: number) {
    cares = reorderItems(cares, fromIndex, toIndex, (c, i) => {
      c.caresListOrder = i;
    });
  }

  async function persistOrder() {
    const careIds = cares.map((c) => c._id);
    await reorderCaresRepo(careIds);
  }

  return {
    get cares() {
      return cares;
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
    load,
    add,
    reorder,
    persistOrder,
  };
}

export function getCareDetailState(careId: string) {
  let care = $state<CareDoc | null>(null);
  let loading = $state(true);
  let showWizard = $state(false);

  async function load() {
    care = await getCare(careId);
    loading = false;
  }

  async function removeTaskPlan(planId: string) {
    await removeTaskPlanRepo(careId, planId);
    await load();
  }

  async function deleteCare() {
    await removeCareRepo(careId);
  }

  async function renameCare(newTitle: string) {
    if (!care) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === care.title) return;
    care.title = trimmed;
    await updateCare(care);
    await load();
  }

  async function addTaskPlan(plan: {
    title: string;
    recurrence: Recurrence;
    overdueBehavior?: OverdueBehavior;
  }): Promise<string | undefined> {
    const doc = await getCare(careId);
    const now = Temporal.Now.instant().toString();
    const { nanoid } = await import('nanoid');
    const planId = `tp_${nanoid()}`;
    doc.taskPlans.push({
      _id: planId,
      title: plan.title,
      recurrence: plan.recurrence,
      overdueBehavior: plan.overdueBehavior,
      createdAt: now,
      updatedAt: now,
    });
    await updateCare(doc);
    showWizard = false;
    await load();
    await runSchedulerNow();
    bumpTaskRefresh();
    return planId;
  }

  function reorderPlans(fromIndex: number, toIndex: number) {
    if (!care) return;
    const plans = [...care.taskPlans];
    care.taskPlans = reorderItems(plans, fromIndex, toIndex, (_p, i) => {});
  }

  async function persistPlansOrder() {
    if (!care) return;
    const planIds = care.taskPlans.map((tp) => tp._id);
    await reorderTaskPlansRepo(careId, planIds);
  }

  return {
    get care() {
      return care;
    },
    get loading() {
      return loading;
    },
    get showWizard() {
      return showWizard;
    },
    set showWizard(v: boolean) {
      showWizard = v;
    },
    load,
    deleteCare,
    renameCare,
    removeTaskPlan,
    addTaskPlan,
    reorderPlans,
    persistPlansOrder,
  };
}

export function getTaskPlanEditState(careId: string, planId: string) {
  let care = $state<CareDoc | null>(null);
  let allCares = $state<CareDoc[]>([]);
  let loading = $state(true);

  const plan = $derived(care?.taskPlans.find((tp) => tp._id === planId) ?? null);

  async function load() {
    care = await getCare(careId);
    allCares = await getAllCares();
    loading = false;
  }

  async function update(updates: {
    title: string;
    recurrence: Recurrence;
    overdueBehavior?: OverdueBehavior;
  }) {
    await updateTaskPlanRepo(careId, planId, updates);
    await load();
    await runSchedulerNow();
    bumpTaskRefresh();
  }

  async function saveAndMove(
    updates: { title: string; recurrence: Recurrence; overdueBehavior?: OverdueBehavior },
    newCareId: string,
  ): Promise<string> {
    if (newCareId === careId) {
      await updateTaskPlanRepo(careId, planId, updates);
      await load();
      await runSchedulerNow();
      bumpTaskRefresh();
      return careId;
    }

    await moveTaskPlanRepo(careId, newCareId, planId);
    await updateTasksCareForPlan(planId, newCareId);
    await updateTaskPlanRepo(newCareId, planId, updates);
    await runSchedulerNow();
    bumpTaskRefresh();

    return newCareId;
  }

  async function deletePlan() {
    await removeTaskPlanRepo(careId, planId);
  }

  return {
    get care() {
      return care;
    },
    get allCares() {
      return allCares;
    },
    get plan() {
      return plan;
    },
    get loading() {
      return loading;
    },
    load,
    update,
    saveAndMove,
    deletePlan,
  };
}
