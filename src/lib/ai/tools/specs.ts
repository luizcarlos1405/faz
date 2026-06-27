export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TASK_STATUS_ENUM = ['TODO', 'DONE', 'MISSED'];
const GOAL_STATUS_ENUM = ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

const dateSchema = { type: 'string', description: 'ISO date YYYY-MM-DD' };
const idSchema = { type: 'string', description: 'Entity id' };

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
    name: 'create_task',
    description:
      'Create a task. doAt is the due date (ISO YYYY-MM-DD). Optionally attach to a goal.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, doAt: dateSchema, goalId: idSchema },
      required: ['title', 'doAt'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_task',
    description: 'Update a task title, due date, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: idSchema,
        title: { type: 'string' },
        doAt: dateSchema,
        status: { type: 'string', enum: TASK_STATUS_ENUM },
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
    name: 'create_goal',
    description: 'Create a goal.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
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
    name: 'delete_inbox_item',
    description: 'Discard an inbox item. The user is offered an Undo.',
    inputSchema: {
      type: 'object',
      properties: { id: idSchema },
      required: ['id'],
      additionalProperties: false,
    },
  },
];
