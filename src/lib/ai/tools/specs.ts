import {
  TASK_STATUS,
  GOAL_STATUS,
  OVERDUE_BEHAVIOR,
  PLAN_TYPE,
  FIXED_DAYS_SUBTYPE,
} from '$lib/types';

export type ToolKind =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'complete'
  | 'uncomplete'
  | 'convert'
  | 'move';

export interface ToolSpec {
  name: string;
  kind: ToolKind;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TASK_STATUS_ENUM = Object.values(TASK_STATUS).map((s) => s.value);
const GOAL_STATUS_ENUM = Object.values(GOAL_STATUS).map((s) => s.value);
const OVERDUE_BEHAVIOR_ENUM = Object.values(OVERDUE_BEHAVIOR).map((s) => s.value);
const SCHEDULE_TYPE_ENUM = Object.values(PLAN_TYPE).map((s) => s.value);
const DAYS_SUBTYPE_ENUM = Object.values(FIXED_DAYS_SUBTYPE).map((s) => s.value);

const dateSchema = { type: 'string', description: 'ISO date YYYY-MM-DD' };
const idSchema = { type: 'string', description: 'Entity id' };

const intervalSchema = {
  type: 'object',
  description: 'Required for INTERVAL_* schedules. At least one unit must be > 0.',
  properties: {
    years: { type: 'number' },
    months: { type: 'number' },
    weeks: { type: 'number' },
    days: { type: 'number' },
  },
  additionalProperties: false,
};

const recurrenceSchema = {
  type: 'object',
  description: 'Recurrence schedule.',
  properties: {
    scheduleType: {
      type: 'string',
      enum: SCHEDULE_TYPE_ENUM,
      description:
        'INTERVAL_FIXED (every N), INTERVAL_AFTER_DONE (N after last completion), or FIXED_DAYS.',
    },
    interval: intervalSchema,
    daysSubtype: {
      type: 'string',
      enum: DAYS_SUBTYPE_ENUM,
      description: 'Required when scheduleType is FIXED_DAYS.',
    },
    daysOfWeek: {
      type: 'array',
      items: { type: 'number' },
      description: 'ISO weekday numbers 1=Mon..7=Sun. For WEEKDAYS.',
    },
    daysOfMonth: {
      type: 'array',
      items: { type: 'number' },
      description: 'Day-of-month numbers 1-31. For MONTHDAYS.',
    },
    yearDates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { month: { type: 'number' }, day: { type: 'number' } },
        required: ['month', 'day'],
        additionalProperties: false,
      },
      description: '{month, day} pairs. For YEARDAYS.',
    },
    startDate: dateSchema,
  },
  required: ['scheduleType', 'startDate'],
  additionalProperties: false,
};

const overdueBehaviorSchema = {
  type: 'string',
  enum: OVERDUE_BEHAVIOR_ENUM,
  description:
    'What happens when an occurrence is overdue. Defaults to KEEP. Ignored (forced to KEEP) for after-completion schedules.',
};

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'list_tasks',
    kind: 'read',
    description: "List the user's tasks. Optionally filter by status, goal, or due date.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: TASK_STATUS_ENUM },
        goalId: idSchema,
        dueBefore: dateSchema,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_task',
    kind: 'read',
    description: 'Get full details of one task by id.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_goals',
    kind: 'read',
    description: 'List all goals with id, title, and status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_goal',
    kind: 'read',
    description: 'Get one goal and its ordered task steps by id.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_inbox',
    kind: 'read',
    description: 'List unprocessed inbox items (the capture queue).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_cares',
    kind: 'read',
    description: 'List all cares (recurring self-care items) with id, title, and plan count.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_care',
    kind: 'read',
    description: 'Get one care and its task plans (with human-readable schedules) by id.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_care',
    kind: 'create',
    description:
      'Create a care (a recurring self-care area). Add task plans to it afterwards. Optionally link to the inbox item it was processed from.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        originInboxItemId: {
          type: 'string',
          description: 'Inbox item this care was processed from.',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_care',
    kind: 'update',
    description: 'Rename a care.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema, title: { type: 'string' } },
      required: ['id', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_care',
    kind: 'delete',
    description: 'Permanently delete a care and all its task plans. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_task_plan',
    kind: 'create',
    description: 'Add a recurring task plan to a care.',
    inputSchema: {
      type: 'object',
      properties: {
        careId: idSchema,
        title: { type: 'string' },
        recurrence: recurrenceSchema,
        overdueBehavior: overdueBehaviorSchema,
      },
      required: ['careId', 'title', 'recurrence'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_task_plan',
    kind: 'update',
    description: 'Update a task plan title, recurrence schedule, or overdue behavior.',
    inputSchema: {
      type: 'object',
      properties: {
        careId: idSchema,
        planId: idSchema,
        title: { type: 'string' },
        recurrence: recurrenceSchema,
        overdueBehavior: overdueBehaviorSchema,
      },
      required: ['careId', 'planId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_task_plan',
    kind: 'delete',
    description: 'Remove a task plan from a care. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { careId: idSchema, planId: idSchema },
      required: ['careId', 'planId'],
      additionalProperties: false,
    },
  },
  {
    name: 'move_task_plan',
    kind: 'move',
    description: 'Move a task plan (and its generated tasks) from one care to another.',
    inputSchema: {
      type: 'object',
      properties: { planId: idSchema, fromCareId: idSchema, toCareId: idSchema },
      required: ['planId', 'fromCareId', 'toCareId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_task',
    kind: 'create',
    description:
      'Create a task. doAt is the due date (ISO YYYY-MM-DD). Optionally attach to a goal or link to the inbox item it was processed from.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        doAt: dateSchema,
        goalId: idSchema,
        originInboxItemId: {
          type: 'string',
          description: 'Inbox item this task was processed from.',
        },
      },
      required: ['title', 'doAt'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_task',
    kind: 'update',
    description:
      'Update a task title or due date. Use complete_task to mark done and uncomplete_task to reopen.',
    inputSchema: {
      type: 'object',
      properties: {
        id: idSchema,
        title: { type: 'string' },
        doAt: dateSchema,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'complete_task',
    kind: 'complete',
    description: 'Mark a task done.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'uncomplete_task',
    kind: 'uncomplete',
    description: 'Move a done task back to todo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_task',
    kind: 'delete',
    description: 'Permanently delete a task. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'convert_task_to_goal',
    kind: 'convert',
    description:
      'Turn a task into a goal (creates a goal from the task title and deletes the task). The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'convert_task_to_care',
    kind: 'convert',
    description:
      'Turn a task into a care (creates a care from the task title and deletes the task). The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_goal',
    kind: 'create',
    description: 'Create a goal. Optionally link to the inbox item it was processed from.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        originInboxItemId: {
          type: 'string',
          description: 'Inbox item this goal was processed from.',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_goal',
    kind: 'update',
    description: 'Update a goal title or status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: idSchema,
        title: { type: 'string' },
        status: { type: 'string', enum: GOAL_STATUS_ENUM },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_goal',
    kind: 'delete',
    description: 'Permanently delete a goal. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_inbox_item',
    kind: 'create',
    description: 'Capture a new inbox item (a thought to process later).',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_inbox_processed',
    kind: 'complete',
    description:
      'Mark an inbox item as dealt with (it leaves the capture queue). Use after converting an inbox item into a task, goal, or care. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

export const TOOL_KIND_BY_NAME: ReadonlyMap<string, ToolKind> = new Map(
  TOOL_SPECS.map((s) => [s.name, s.kind]),
);

export function toolKind(name: string): ToolKind | undefined {
  return TOOL_KIND_BY_NAME.get(name);
}

export function isReadonlyTool(name: string): boolean {
  return toolKind(name) === 'read';
}

export function isMutatingTool(name: string): boolean {
  return !isReadonlyTool(name);
}
