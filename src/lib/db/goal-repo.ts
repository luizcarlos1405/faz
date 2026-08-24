import { Temporal } from '@js-temporal/polyfill';
import { nanoid } from 'nanoid';
import { getDb, FIND_LIMIT_ALL } from './database';
import { nextOrder, byListOrder } from '$lib/engines/ordering';
import { calculateGoalStatus, isGoalPaused } from '$lib/engines/goal-engine';
import { getTasksByGoal } from './task-repo';
import { DOC_TYPE, GOAL_STATUS, type GoalDoc } from '$lib/types';

export async function createGoal(
  title: string,
  originInboxItemId?: string,
  paused = false,
): Promise<GoalDoc> {
  const now = Temporal.Now.instant().toString();
  const existing = await getAllGoals();
  const doc: GoalDoc = {
    _id: `${DOC_TYPE.GOAL.idPrefix}${nanoid()}`,
    type: DOC_TYPE.GOAL.value,
    title,
    status: GOAL_STATUS.NOT_STARTED.value,
    goalsListOrder: nextOrder(
      existing.filter((g) => g.pausedAt == null).map((g) => g.goalsListOrder),
    ),
    originInboxItemId,
    createdAt: now,
    updatedAt: now,
  };
  if (paused) doc.pausedAt = now;
  const db = await getDb();
  const result = await db.put(doc);
  doc._rev = result.rev;
  return doc;
}

export async function getGoal(id: string): Promise<GoalDoc> {
  const db = await getDb();
  return db.get<GoalDoc>(id);
}

export async function updateGoal(doc: GoalDoc): Promise<GoalDoc> {
  const db = await getDb();
  doc.updatedAt = Temporal.Now.instant().toString();
  const result = await db.put(doc);
  doc._rev = result.rev;
  return doc;
}

export async function removeGoal(id: string): Promise<void> {
  const db = await getDb();
  const doc = await db.get<GoalDoc>(id);
  await db.remove(doc);
}

export async function restoreGoal(doc: GoalDoc): Promise<GoalDoc> {
  const db = await getDb();
  const toPut: GoalDoc = { ...doc };
  delete toPut._rev;
  toPut.updatedAt = Temporal.Now.instant().toString();
  const result = await db.put(toPut);
  toPut._rev = result.rev;
  return toPut;
}

export async function pauseGoal(id: string): Promise<GoalDoc> {
  const goal = await getGoal(id);
  if (isGoalPaused(goal)) return goal;
  goal.pausedAt = Temporal.Now.instant().toString();
  return updateGoal(goal);
}

export async function resumeGoal(id: string): Promise<GoalDoc> {
  const goal = await getGoal(id);
  if (!isGoalPaused(goal)) return goal;
  delete goal.pausedAt;
  const active = (await getAllGoals()).filter((g) => !isGoalPaused(g));
  goal.goalsListOrder = nextOrder(active.map((g) => g.goalsListOrder));
  return updateGoal(goal);
}

export async function getAllGoals(): Promise<GoalDoc[]> {
  const db = await getDb();
  const result = await db.find({
    selector: { type: DOC_TYPE.GOAL.value, createdAt: { $gt: null } },
    sort: [{ type: 'asc' }, { createdAt: 'desc' }],
    limit: FIND_LIMIT_ALL,
  });
  const goals = result.docs as GoalDoc[];
  return goals.toSorted(byListOrder((g) => g.goalsListOrder));
}

export async function reorderGoals(goalIds: string[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < goalIds.length; i++) {
    const doc = await db.get<GoalDoc>(goalIds[i]);
    doc.goalsListOrder = i;
    doc.updatedAt = Temporal.Now.instant().toString();
    await db.put(doc);
  }
}

export async function recalcGoalStatus(goalId: string): Promise<void> {
  const goal = await getGoal(goalId);
  const tasks = await getTasksByGoal(goalId);
  const newStatus = calculateGoalStatus(goal, tasks);
  if (goal.status !== newStatus) {
    goal.status = newStatus;
    await updateGoal(goal);
  }
}
