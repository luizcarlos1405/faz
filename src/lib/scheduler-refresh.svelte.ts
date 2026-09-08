import { Temporal } from '@js-temporal/polyfill';
import { msUntilNextMinute } from '$lib/engines/defer-engine';

let version = $state(0);
let nowIso = $state(Temporal.Now.instant().toString());

export function bumpTaskRefresh(): void {
  version++;
}

export function getTaskRefreshVersion(): number {
  return version;
}

export function bumpClock(): void {
  nowIso = Temporal.Now.instant().toString();
}

export function getNow(): Temporal.Instant {
  return Temporal.Instant.from(nowIso);
}

export function startMinuteTicker(): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    bumpClock();
    interval = setInterval(bumpClock, 60_000);
  }, msUntilNextMinute(Temporal.Now.instant()));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
