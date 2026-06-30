export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TASK_STATUS_ENUM = ['TODO', 'DONE', 'MISSED'];
const GOAL_STATUS_ENUM = ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
const OVERDUE_BEHAVIOR_ENUM = ['KEEP', 'MISSED', 'DISCARD'];
const SCHEDULE_TYPE_ENUM = ['INTERVAL_FIXED', 'INTERVAL_AFTER_DONE', 'FIXED_DAYS'];
const DAYS_SUBTYPE_ENUM = ['WEEKDAYS', 'MONTHDAYS', 'YEARDAYS'];

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
  description: 'What happens when an occurrence is overdue. Defaults to KEEP.',
};

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'list_tasks',
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
    description: 'List all goals with id, title, and status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_goal',
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
    description: 'List unprocessed inbox items (the capture queue).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_cares',
    description: 'List all cares (recurring self-care items) with id, title, and plan count.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_care',
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
    description:
      'Mark an inbox item as dealt with (it leaves the capture queue). Use after converting an inbox item into a task, goal, or care. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_inbox_item',
    description:
      'Discard an inbox item without acting on it (archives it). The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
];
