import { Temporal } from '@js-temporal/polyfill';
import { getVisibleTasks } from '$lib/db/task-repo';
import { getAllGoals } from '$lib/db/goal-repo';
import { getUnprocessed } from '$lib/db/inbox-repo';
import type { AgentContext } from './context';

const MAX_TASKS_IN_PROMPT = 30;

export async function gatherContext(): Promise<AgentContext> {
  const today = Temporal.Now.plainDateISO().toString();
  const [tasks, goals, inbox] = await Promise.all([
    getVisibleTasks(today),
    getAllGoals(),
    getUnprocessed(),
  ]);
  return {
    today,
    tasks: tasks.slice(0, MAX_TASKS_IN_PROMPT).map((t) => ({
      id: t._id,
      title: t.title,
      doAt: t.doAt,
      status: t.status,
    })),
    goals: goals.map((g) => ({ id: g._id, title: g.title, status: g.status })),
    inboxCount: inbox.length,
  };
}
