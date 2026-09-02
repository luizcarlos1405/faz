import { Temporal } from '@js-temporal/polyfill';
import {
  DOC_TYPE,
  TASK_STATUS,
  OVERDUE_BEHAVIOR,
  RECURRENCE_TYPE,
  INTERVAL_SUBTYPE,
  FIXED_DAYS_SUBTYPE,
} from '$lib/types';
import type {
  TaskDoc,
  TaskPlan,
  CareDoc,
  DurationLike,
  OverdueBehavior,
  Recurrence,
  IntervalAfterDoneRecurrence,
} from '$lib/types';

export function isAfterDoneRecurrence(
  recurrence: Recurrence,
): recurrence is IntervalAfterDoneRecurrence {
  return (
    recurrence.type === RECURRENCE_TYPE.INTERVAL.value &&
    recurrence.subtype === INTERVAL_SUBTYPE.AFTER_DONE.value
  );
}

export function evaluateTaskPlan(
  plan: TaskPlan,
  today: Temporal.PlainDate,
  existingTasks: TaskDoc[],
): TaskDoc | null {
  const r = plan.recurrence;
  if (r.type === RECURRENCE_TYPE.INTERVAL.value && r.subtype === INTERVAL_SUBTYPE.FIXED.value) {
    return evaluateIntervalFixed(plan, today, existingTasks);
  }
  if (isAfterDoneRecurrence(r)) {
    return evaluateIntervalAfterDone(plan, today, existingTasks);
  }
  if (r.type === RECURRENCE_TYPE.FIXED_DAYS.value) {
    const tasks = evaluateFixedDays(plan, today, existingTasks);
    return tasks.length > 0 ? tasks[0] : null;
  }
  return null;
}

export function evaluateIntervalFixed(
  plan: TaskPlan,
  today: Temporal.PlainDate,
  existingTasks: TaskDoc[],
): TaskDoc | null {
  const r = plan.recurrence;
  if (r.type !== RECURRENCE_TYPE.INTERVAL.value || r.subtype !== INTERVAL_SUBTYPE.FIXED.value)
    return null;

  const startDate = Temporal.PlainDate.from(r.startDate);
  let candidate = startDate;
  let multiple = 0;

  while (Temporal.PlainDate.compare(candidate, today) < 0) {
    const next = addDuration(startDate, scaleDuration(r.interval, multiple + 1));
    if (Temporal.PlainDate.compare(next, candidate) <= 0) return null;
    multiple++;
    candidate = next;
  }

  if (hasTaskForDate(existingTasks, plan._id, candidate.toString())) return null;

  return makeTask(plan, candidate.toString());
}

export function evaluateIntervalAfterDone(
  plan: TaskPlan,
  today: Temporal.PlainDate,
  existingTasks: TaskDoc[],
): TaskDoc | null {
  const r = plan.recurrence;
  if (!isAfterDoneRecurrence(r)) return null;

  const hasActive = existingTasks.some((t) => t.status === TASK_STATUS.TODO.value);
  if (hasActive) return null;

  let doAt: Temporal.PlainDate;
  if (plan.lastDoneDate) {
    doAt = addDuration(Temporal.PlainDate.from(plan.lastDoneDate), r.interval);
  } else {
    doAt = Temporal.PlainDate.from(r.startDate);
  }

  return makeTask(plan, doAt.toString());
}

export function evaluateFixedDays(
  plan: TaskPlan,
  today: Temporal.PlainDate,
  existingTasks: TaskDoc[],
): TaskDoc[] {
  const r = plan.recurrence;
  if (r.type !== RECURRENCE_TYPE.FIXED_DAYS.value) return [];

  const startDate = Temporal.PlainDate.from(r.startDate);
  const effectiveStart = Temporal.PlainDate.compare(today, startDate) >= 0 ? today : startDate;

  const tasks: TaskDoc[] = [];

  if (r.subtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) {
    for (const dow of r.daysOfWeek) {
      const next = nextWeekday(effectiveStart, dow);
      if (shouldGenerateForDate(plan, existingTasks, next.toString())) {
        tasks.push(makeTask(plan, next.toString()));
      }
    }
  } else if (r.subtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) {
    for (const dom of r.daysOfMonth) {
      const next = nextMonthday(effectiveStart, dom);
      if (shouldGenerateForDate(plan, existingTasks, next.toString())) {
        tasks.push(makeTask(plan, next.toString()));
      }
    }
  } else if (r.subtype === FIXED_DAYS_SUBTYPE.YEARDAYS.value) {
    for (const { month, day } of r.dates) {
      const next = nextYearday(effectiveStart, month, day);
      if (shouldGenerateForDate(plan, existingTasks, next.toString())) {
        tasks.push(makeTask(plan, next.toString()));
      }
    }
  }

  return tasks;
}

export function runScheduler(
  cares: CareDoc[],
  today: Temporal.PlainDate,
  getTasksForPlan: (planId: string) => TaskDoc[],
): {
  tasks: TaskDoc[];
  updatedPlans: Map<string, TaskPlan>;
  missedTasks: TaskDoc[];
  discardedTaskIds: string[];
} {
  const generatedTasks: TaskDoc[] = [];
  const updatedPlans = new Map<string, TaskPlan>();
  const missedTasks: TaskDoc[] = [];
  const discardedTaskIds: string[] = [];

  for (const care of cares) {
    for (const plan of care.taskPlans) {
      const existingTasks = getTasksForPlan(plan._id);

      const overdue = applyOverdueBehavior(plan, today, existingTasks);
      missedTasks.push(...overdue.missedTasks);
      discardedTaskIds.push(...overdue.discardedTaskIds);

      const filtered = existingTasks.filter((t) => !overdue.discardedTaskIds.includes(t._id));

      const task = evaluateTaskPlan(plan, today, filtered);
      if (task) {
        task.careId = care._id;
        generatedTasks.push(task);
        const updated = { ...plan, lastDoAtDate: task.doAt };
        updatedPlans.set(plan._id, updated);
      }
    }
  }

  return { tasks: generatedTasks, updatedPlans, missedTasks, discardedTaskIds };
}

export function applyOverdueBehavior(
  plan: TaskPlan,
  today: Temporal.PlainDate,
  tasks: TaskDoc[],
): { missedTasks: TaskDoc[]; discardedTaskIds: string[] } {
  if (isAfterDoneRecurrence(plan.recurrence)) {
    return { missedTasks: [], discardedTaskIds: [] };
  }

  const behavior: OverdueBehavior = plan.overdueBehavior ?? OVERDUE_BEHAVIOR.KEEP.value;

  const overdueTodo = tasks.filter(
    (t) =>
      t.status === TASK_STATUS.TODO.value &&
      Temporal.PlainDate.compare(Temporal.PlainDate.from(t.doAt), today) < 0,
  );

  if (behavior === OVERDUE_BEHAVIOR.MISSED.value) {
    return {
      missedTasks: overdueTodo.map((t) => ({ ...t, status: TASK_STATUS.MISSED.value })),
      discardedTaskIds: [],
    };
  }

  if (behavior === OVERDUE_BEHAVIOR.DISCARD.value) {
    return {
      missedTasks: [],
      discardedTaskIds: overdueTodo.map((t) => t._id),
    };
  }

  return { missedTasks: [], discardedTaskIds: [] };
}

function addDuration(date: Temporal.PlainDate, duration: DurationLike): Temporal.PlainDate {
  const d = Temporal.Duration.from({
    years: duration.years ?? 0,
    months: duration.months ?? 0,
    weeks: duration.weeks ?? 0,
    days: duration.days ?? 0,
  });
  return date.add(d);
}

function scaleDuration(duration: DurationLike, multiple: number): DurationLike {
  return {
    years: (duration.years ?? 0) * multiple,
    months: (duration.months ?? 0) * multiple,
    weeks: (duration.weeks ?? 0) * multiple,
    days: (duration.days ?? 0) * multiple,
  };
}

function makeTask(plan: TaskPlan, doAt: string): TaskDoc {
  return {
    _id: `${DOC_TYPE.TASK.idPrefix}gen_${plan._id}_${doAt}`,
    type: DOC_TYPE.TASK.value,
    title: plan.title,
    doAt,
    status: TASK_STATUS.TODO.value,
    careId: undefined,
    taskPlanId: plan._id,
    createdAt: Temporal.Now.instant().toString(),
    updatedAt: Temporal.Now.instant().toString(),
  };
}

function hasTaskForDate(tasks: TaskDoc[], planId: string, doAt: string): boolean {
  return tasks.some((t) => t.taskPlanId === planId && t.doAt === doAt);
}

function shouldGenerateForDate(plan: TaskPlan, existingTasks: TaskDoc[], dateStr: string): boolean {
  return plan.lastDoAtDate !== dateStr && !hasTaskForDate(existingTasks, plan._id, dateStr);
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function nextWeekday(from: Temporal.PlainDate, dayOfWeek: number): Temporal.PlainDate {
  let d = from;
  for (let i = 0; i < 7; i++) {
    if (d.dayOfWeek === dayOfWeek) return d;
    d = d.add({ days: 1 });
  }
  return d;
}

function nextMonthday(from: Temporal.PlainDate, dayOfMonth: number): Temporal.PlainDate {
  const clamp = (year: number, month: number, day: number): number => {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const max = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];
    return Math.min(day, max);
  };

  let candidate = Temporal.PlainDate.from({
    year: from.year,
    month: from.month,
    day: clamp(from.year, from.month, dayOfMonth),
  });

  if (Temporal.PlainDate.compare(candidate, from) >= 0) return candidate;

  let nextMonth = from.month + 1;
  let nextYear = from.year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  return Temporal.PlainDate.from({
    year: nextYear,
    month: nextMonth,
    day: clamp(nextYear, nextMonth, dayOfMonth),
  });
}

function nextYearday(from: Temporal.PlainDate, month: number, day: number): Temporal.PlainDate {
  const clampDay = (year: number): number => {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const max = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];
    return Math.min(day, max);
  };

  const thisYear = Temporal.PlainDate.from({
    year: from.year,
    month,
    day: clampDay(from.year),
  });

  if (Temporal.PlainDate.compare(thisYear, from) >= 0) return thisYear;

  return Temporal.PlainDate.from({
    year: from.year + 1,
    month,
    day: clampDay(from.year + 1),
  });
}
