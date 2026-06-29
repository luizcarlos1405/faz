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
import { getCare, getAllCares } from '$lib/db/care-repo';
import { describeRecurrence } from '$lib/engines/recurrence-wizard';
import { TASK_STATUS, GOAL_STATUS, type TaskDoc } from '$lib/types';

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

const TASK_STATUSES = new Set(Object.values(TASK_STATUS).map((s) => s.value));
const GOAL_STATUSES = new Set(Object.values(GOAL_STATUS).map((s) => s.value));
const LIST_LIMIT = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE.test(v);
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
    goalId: t.goalId,
    careId: t.careId,
  };
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

    case 'create_task': {
      const title = str(args.title);
      if (!title) return fail('Create task failed', 'title is required.');
      if (!isIsoDate(args.doAt))
        return fail('Create task failed', 'doAt must be an ISO date YYYY-MM-DD.');
      const goalId = str(args.goalId) || undefined;
      const task = await createTask({ title, doAt: args.doAt, goalId });
      if (goalId) await recalcGoalStatus(goalId).catch(() => {});
      return ok(`Created task: ${title}`, { id: task._id, title });
    }

    case 'update_task': {
      const id = str(args.id);
      if (!id) return fail('Update task failed', 'id is required.');
      const task = await getOrFail('Update task', id, () => getTask(id));
      if ('ok' in task) return task;
      const title = str(args.title);
      if (title) task.title = title;
      if (isIsoDate(args.doAt)) task.doAt = args.doAt;
      if (args.status !== undefined) {
        if (!TASK_STATUSES.has(args.status)) {
          return fail(
            'Update task failed',
            `Invalid status. Valid: ${[...TASK_STATUSES].join(', ')}.`,
          );
        }
        task.status = args.status;
      }
      await updateTask(task);
      if (task.goalId) await recalcGoalStatus(task.goalId).catch(() => {});
      return ok(`Updated task: ${task.title}`, { id, title: task.title });
    }

    case 'complete_task': {
      const id = str(args.id);
      const task = await getOrFail('Complete task', id, () => getTask(id));
      if ('ok' in task) return task;
      const done = await completeTask(id);
      if (done.goalId) await recalcGoalStatus(done.goalId).catch(() => {});
      return ok(`Completed task: ${done.title}`, { id, status: done.status });
    }

    case 'uncomplete_task': {
      const id = str(args.id);
      const task = await getOrFail('Reopen task', id, () => getTask(id));
      if ('ok' in task) return task;
      const reopened = await uncompleteTask(id);
      if (reopened.goalId) await recalcGoalStatus(reopened.goalId).catch(() => {});
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

    case 'create_goal': {
      const title = str(args.title);
      if (!title) return fail('Create goal failed', 'title is required.');
      const goal = await createGoal(title);
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

    case 'delete_inbox_item': {
      const id = str(args.id);
      const item = await getOrFail('Discard inbox', id, () => getInboxItem(id));
      if ('ok' in item) return item;
      await markProcessed(id);
      return ok(
        `Discarded inbox: ${item.title}`,
        { id, discarded: true },
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
