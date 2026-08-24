import { describe, it, expect } from 'vitest';
import { calculateGoalStatus, isGoalArchived, partitionGoalsByArchive } from '../goal-engine';
import { DOC_TYPE, TASK_STATUS, GOAL_STATUS, type GoalDoc, type TaskDoc } from '$lib/types';

function makeGoal(
  status: GoalDoc['status'] = GOAL_STATUS.NOT_STARTED.value,
  overrides: Partial<GoalDoc> = {},
): GoalDoc {
  return {
    _id: 'goal_1',
    type: DOC_TYPE.GOAL.value,
    title: 'Test Goal',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
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

describe('isGoalArchived', () => {
  it('returns false when archivedAt is missing', () => {
    expect(isGoalArchived(makeGoal())).toBe(false);
  });

  it('returns true when archivedAt is set', () => {
    expect(
      isGoalArchived(makeGoal(GOAL_STATUS.NOT_STARTED.value, { archivedAt: '2026-01-02' })),
    ).toBe(true);
  });
});

describe('partitionGoalsByArchive', () => {
  it('returns empty lists for empty input', () => {
    expect(partitionGoalsByArchive([])).toEqual({ active: [], archived: [] });
  });

  it('puts all goals in active when none are archived', () => {
    const goals = [makeGoal(), makeGoal()];
    const { active, archived } = partitionGoalsByArchive(goals);
    expect(active).toEqual(goals);
    expect(archived).toEqual([]);
  });

  it('puts all goals in archived when all are archived, most recent first', () => {
    const goals = [
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_1', archivedAt: '2026-01-01' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_2', archivedAt: '2026-03-01' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_3', archivedAt: '2026-02-01' }),
    ];
    const { active, archived } = partitionGoalsByArchive(goals);
    expect(active).toEqual([]);
    expect(archived.map((g) => g._id)).toEqual(['goal_2', 'goal_3', 'goal_1']);
  });

  it('partitions a mixed list preserving active input order', () => {
    const goals = [
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_a' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_b', archivedAt: '2026-01-01' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_c' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_d', archivedAt: '2026-02-01' }),
    ];
    const { active, archived } = partitionGoalsByArchive(goals);
    expect(active.map((g) => g._id)).toEqual(['goal_a', 'goal_c']);
    expect(archived.map((g) => g._id)).toEqual(['goal_d', 'goal_b']);
  });

  it('does not mutate the input array', () => {
    const goals = [
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_1', archivedAt: '2026-01-01' }),
      makeGoal(GOAL_STATUS.NOT_STARTED.value, { _id: 'goal_2', archivedAt: '2026-02-01' }),
    ];
    partitionGoalsByArchive(goals);
    expect(goals.map((g) => g._id)).toEqual(['goal_1', 'goal_2']);
  });
});
