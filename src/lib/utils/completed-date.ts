export function completedOnLocalDate(completedAt: string, _timeZone: string): string {
  return completedAt.slice(0, 10);
}
