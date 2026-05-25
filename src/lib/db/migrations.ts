import { Temporal } from '@js-temporal/polyfill';
import type { Database } from './database';
import { FIND_LIMIT_ALL } from './database';
import { DOC_TYPE, type TaskDoc } from '$lib/types';
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
    await (db as PouchDB.Database).put(state);
  }
}
