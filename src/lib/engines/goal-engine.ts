import { TASK_STATUS, GOAL_STATUS, type GoalDoc, type TaskDoc, type GoalStatus } from '$lib/types';

export function calculateGoalStatus(goal: GoalDoc, tasks: TaskDoc[]): GoalStatus {
  if (tasks.length === 0) return GOAL_STATUS.NOT_STARTED.value;

  const allDone = tasks.every((t) => t.status === TASK_STATUS.DONE.value);
  if (allDone) return GOAL_STATUS.REVIEW.value;

  return GOAL_STATUS.IN_PROGRESS.value;
}
