import { Temporal } from '@js-temporal/polyfill';
import type { Database } from './database';
import { FIND_LIMIT_ALL } from './database';
import { DOC_TYPE, type CareDoc, type TaskDoc } from '$lib/types';
import PouchDB from 'pouchdb-browser';

interface MigrationStateDoc {
  _id: 'meta:migrations';
  _rev?: string;
  version: number;
  updatedAt?: string;
}

type MigrationFn = (db: Database) => Promise<void>;

interface Migration {
  version: number;
  description: string;
  up: MigrationFn;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Backfill stepOrder for goal tasks that predate the field',
    up: async (db) => {
      const { docs } = await db.find({
        selector: {
          type: DOC_TYPE.TASK.value,
          goalId: { $exists: true },
        },
        limit: FIND_LIMIT_ALL,
      });
      const tasks = docs as TaskDoc[];
      const needsMigration = tasks.some((t) => t.stepOrder == null);
      if (!needsMigration) return;

      const byGoal = new Map<string, TaskDoc[]>();
      for (const task of tasks) {
        if (!task.goalId) continue;
        const list = byGoal.get(task.goalId) ?? [];
        list.push(task);
        byGoal.set(task.goalId, list);
      }

      for (const [, goalTasks] of byGoal) {
        const sorted = goalTasks.toSorted((a, b) => {
          const doAtDiff = a.doAt.localeCompare(b.doAt);
          if (doAtDiff !== 0) return doAtDiff;
          return a.createdAt.localeCompare(b.createdAt);
        });
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i].stepOrder !== i) {
            sorted[i].stepOrder = i;
            sorted[i].updatedAt = Temporal.Now.instant().toString();
            await db.put(sorted[i]);
          }
        }
      }
    },
  },
  {
    version: 2,
    description: 'Convert WEEKDAYS daysOfWeek from JS 0-6 convention to ISO 1-7',
    up: async (db) => {
      const { docs } = await db.find({
        selector: { type: DOC_TYPE.CARE.value },
        limit: FIND_LIMIT_ALL,
      });
      const cares = docs as CareDoc[];
      let changed = false;

      const jsToIso = (d: number): number => {
        if (d === 0) return 7;
        return d;
      };

      for (const care of cares) {
        for (const plan of care.taskPlans) {
          if (plan.recurrence.type === 'FIXED_DAYS' && plan.recurrence.subtype === 'WEEKDAYS') {
            const needsFix = plan.recurrence.daysOfWeek.some((d) => d < 1 || d > 7);
            if (needsFix) {
              plan.recurrence.daysOfWeek = plan.recurrence.daysOfWeek.map(jsToIso);
              changed = true;
            }
          }
        }
        if (changed) {
          care.updatedAt = Temporal.Now.instant().toString();
          await db.put(care);
          changed = false;
        }
      }
    },
  },
];

export async function runMigrations(db: Database): Promise<void> {
  let state: MigrationStateDoc;
  try {
    state = await db.get<MigrationStateDoc>('meta:migrations');
  } catch {
    state = { _id: 'meta:migrations', version: 0 };
  }

  const pending = migrations.filter((m) => m.version > state.version);
  if (pending.length === 0) return;

  for (const migration of pending) {
    await migration.up(db);
    state.version = migration.version;
    state.updatedAt = Temporal.Now.instant().toString();
    const result = await (db as PouchDB.Database).put(state);
    state._rev = result.rev;
  }
}
