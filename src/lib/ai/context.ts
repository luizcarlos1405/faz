export interface AgentContext {
  today: string;
  tasks: { id: string; title: string; doAt: string; status: string }[];
  goals: { id: string; title: string; status: string }[];
  inboxCount: number;
}

export function buildSystemContext(ctx: AgentContext): string {
  const taskLines =
    ctx.tasks.length > 0
      ? ctx.tasks.map((t) => `- ${t.title} (id ${t.id}, due ${t.doAt}, ${t.status})`).join('\n')
      : '- (none)';
  const goalLines =
    ctx.goals.length > 0
      ? ctx.goals.map((g) => `- ${g.title} (id ${g.id}, ${g.status})`).join('\n')
      : '- (none)';

  return [
    `You are Faz, the AI assistant inside the user's personal task manager. Today is ${ctx.today}.`,
    "You help with planning and may act on the user's real data using tools (tasks, goals, inbox).",
    'Rules:',
    '- Use tools to read current data before changing it; never invent ids or statuses.',
    '- Task status: TODO, DONE, MISSED. Goal status: NOT_STARTED, IN_PROGRESS, REVIEW, COMPLETED.',
    '- Dates are ISO YYYY-MM-DD.',
    'Current snapshot:',
    `Active tasks (due today or earlier, ${ctx.tasks.length}):`,
    taskLines,
    `Goals (${ctx.goals.length}):`,
    goalLines,
    `Inbox: ${ctx.inboxCount} unprocessed item(s).`,
  ].join('\n');
}
