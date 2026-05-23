export const DOC_TYPE = {
  INBOX_ITEM: { value: 'InboxItem', idPrefix: 'inbox_' },
  TASK: { value: 'Task', idPrefix: 'task_' },
  GOAL: { value: 'Goal', idPrefix: 'goal_' },
  CARE: { value: 'Care', idPrefix: 'care_' },
} as const;

export const TASK_STATUS = {
  TODO: { value: 'TODO' },
  DONE: { value: 'DONE' },
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]['value'];

export const GOAL_STATUS = {
  NOT_STARTED: { value: 'NOT_STARTED' },
  IN_PROGRESS: { value: 'IN_PROGRESS' },
  REVIEW: { value: 'REVIEW' },
  COMPLETED: { value: 'COMPLETED' },
} as const;

export type GoalStatus = (typeof GOAL_STATUS)[keyof typeof GOAL_STATUS]['value'];

export type RecurrenceType = 'INTERVAL' | 'FIXED_DAYS';
export type IntervalSubtype = 'FIXED' | 'AFTER_DONE';
export type FixedDaysSubtype = 'WEEKDAYS' | 'MONTHDAYS' | 'YEARDAYS';

export interface DurationLike {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
}

export interface IntervalFixedRecurrence {
  type: 'INTERVAL';
  subtype: 'FIXED';
  interval: DurationLike;
  startDate: string;
}

export interface IntervalAfterDoneRecurrence {
  type: 'INTERVAL';
  subtype: 'AFTER_DONE';
  interval: DurationLike;
  startDate: string;
}

export interface WeekdaysRecurrence {
  type: 'FIXED_DAYS';
  subtype: 'WEEKDAYS';
  daysOfWeek: number[];
  startDate: string;
}

export interface MonthdaysRecurrence {
  type: 'FIXED_DAYS';
  subtype: 'MONTHDAYS';
  daysOfMonth: number[];
  startDate: string;
}

export interface YeardaysRecurrence {
  type: 'FIXED_DAYS';
  subtype: 'YEARDAYS';
  dates: { month: number; day: number }[];
  startDate: string;
}

export type Recurrence =
  | IntervalFixedRecurrence
  | IntervalAfterDoneRecurrence
  | WeekdaysRecurrence
  | MonthdaysRecurrence
  | YeardaysRecurrence;

export interface InboxItemDoc {
  _id: string;
  _rev?: string;
  type: typeof DOC_TYPE.INBOX_ITEM.value;
  title: string;
  isProcessed: boolean;
  createdAt: string;
}

export interface TaskDoc {
  _id: string;
  _rev?: string;
  type: typeof DOC_TYPE.TASK.value;
  title: string;
  doAt: string;
  status: TaskStatus;
  goalId?: string;
  stepOrder?: number;
  originInboxItemId?: string;
  careId?: string;
  taskPlanId?: string;
  completedAt?: string;
  tasksListOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalDoc {
  _id: string;
  _rev?: string;
  type: typeof DOC_TYPE.GOAL.value;
  title: string;
  status: GoalStatus;
  goalsListOrder?: number;
  originInboxItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPlan {
  _id: string;
  title: string;
  recurrence: Recurrence;
  lastDoAtDate?: string;
  lastDoneDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareDoc {
  _id: string;
  _rev?: string;
  type: typeof DOC_TYPE.CARE.value;
  title: string;
  taskPlans: TaskPlan[];
  caresListOrder?: number;
  originInboxItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export type FazDoc = InboxItemDoc | TaskDoc | GoalDoc | CareDoc;
