import { Temporal } from '@js-temporal/polyfill';
import { getVisibleTasks } from '$lib/db/task-repo';
import { getAllGoals } from '$lib/db/goal-repo';
import { getUnprocessed } from '$lib/db/inbox-repo';
import { getAllCares } from '$lib/db/care-repo';
import type { AgentContext } from './context';

const MAX_TASKS_IN_PROMPT = 30;
const MAX_CARES_IN_PROMPT = 10;

export async function gatherContext(): Promise<AgentContext> {
  const today = Temporal.Now.plainDateISO().toString();
  const [tasks, goals, inbox, cares] = await Promise.all([
    getVisibleTasks(today),
    getAllGoals(),
    getUnprocessed(),
    getAllCares(),
  ]);
  return {
    today,
    tasks: tasks.slice(0, MAX_TASKS_IN_PROMPT).map((t) => ({
      id: t._id,
      title: t.title,
      doAt: t.doAt,
      status: t.status,
      doAfter: t.doAfter,
    })),
    goals: goals.map((g) => ({ id: g._id, title: g.title, status: g.status })),
    cares: cares.slice(0, MAX_CARES_IN_PROMPT).map((c) => ({
      id: c._id,
      title: c.title,
      planCount: c.taskPlans.length,
    })),
    inboxCount: inbox.length,
  };
}
