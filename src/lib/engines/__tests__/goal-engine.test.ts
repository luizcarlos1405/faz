import { describe, it, expect } from 'vitest';
import { calculateGoalStatus } from '../goal-engine';
import { DOC_TYPE, TASK_STATUS, GOAL_STATUS, type GoalDoc, type TaskDoc } from '$lib/types';

function makeGoal(status: GoalDoc['status'] = GOAL_STATUS.NOT_STARTED.value): GoalDoc {
  return {
    _id: 'goal_1',
    type: DOC_TYPE.GOAL.value,
    title: 'Test Goal',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeTask(
  status: TaskDoc['status'] = TASK_STATUS.TODO.value,
  overrides: Partial<TaskDoc> = {},
): TaskDoc {
  return {
    _id: 'task_1',
    type: DOC_TYPE.TASK.value,
    title: 'T',
    doAt: '2026-01-01',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    goalId: 'goal_1',
    ...overrides,
  };
}

describe('calculateGoalStatus', () => {
  it('returns NOT_STARTED when no tasks', () => {
    expect(calculateGoalStatus(makeGoal(), [])).toBe(GOAL_STATUS.NOT_STARTED.value);
  });

  it('returns IN_PROGRESS when some tasks are not done', () => {
    const tasks = [makeTask(TASK_STATUS.TODO.value), makeTask(TASK_STATUS.DONE.value)];
    expect(calculateGoalStatus(makeGoal(), tasks)).toBe(GOAL_STATUS.IN_PROGRESS.value);
  });

  it('returns IN_PROGRESS when all tasks are TODO', () => {
    const tasks = [makeTask(TASK_STATUS.TODO.value), makeTask(TASK_STATUS.TODO.value)];
    expect(calculateGoalStatus(makeGoal(), tasks)).toBe(GOAL_STATUS.IN_PROGRESS.value);
  });

  it('returns REVIEW when all tasks are DONE', () => {
    const tasks = [makeTask(TASK_STATUS.DONE.value), makeTask(TASK_STATUS.DONE.value)];
    expect(calculateGoalStatus(makeGoal(), tasks)).toBe(GOAL_STATUS.REVIEW.value);
  });

  it('returns IN_PROGRESS when adding TODO task to COMPLETED goal', () => {
    const tasks = [makeTask(TASK_STATUS.TODO.value)];
    expect(calculateGoalStatus(makeGoal(GOAL_STATUS.COMPLETED.value), tasks)).toBe(
      GOAL_STATUS.IN_PROGRESS.value,
    );
  });

  it('returns NOT_STARTED for COMPLETED goal with no tasks', () => {
    expect(calculateGoalStatus(makeGoal(GOAL_STATUS.COMPLETED.value), [])).toBe(
      GOAL_STATUS.NOT_STARTED.value,
    );
  });
});
