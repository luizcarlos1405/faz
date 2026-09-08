import { Temporal } from '@js-temporal/polyfill';
import { nanoid } from 'nanoid';
import PouchDB from 'pouchdb-browser';
import { getDb, FIND_LIMIT_ALL } from './database';
import { DOC_TYPE, type ErrorDoc } from '$lib/types';

async function getErrorDb(): Promise<PouchDB.Database<ErrorDoc>> {
  return (await getDb()) as unknown as PouchDB.Database<ErrorDoc>;
}

export async function logError(args: {
  code: string;
  message: string;
  details?: unknown;
}): Promise<void> {
  const doc: ErrorDoc = {
    _id: `${DOC_TYPE.ERROR.idPrefix}${nanoid()}`,
    type: DOC_TYPE.ERROR.value,
    code: args.code,
    message: args.message,
    details: args.details === undefined ? undefined : JSON.stringify(args.details),
    createdAt: Temporal.Now.instant().toString(),
  };
  try {
    const db = await getErrorDb();
    await db.put(doc);
  } catch (e) {
    console.error('[error-repo] failed to persist error', e);
  }
}

export async function getErrors(): Promise<ErrorDoc[]> {
  const db = await getErrorDb();
  const result = await db.find({
    selector: { type: DOC_TYPE.ERROR.value, createdAt: { $gt: null } },
    sort: [{ type: 'desc' }, { createdAt: 'desc' }],
    limit: FIND_LIMIT_ALL,
  });
  return result.docs;
}

export async function clearErrors(): Promise<void> {
  const db = await getErrorDb();
  const result = await db.find({
    selector: { type: DOC_TYPE.ERROR.value },
    limit: FIND_LIMIT_ALL,
  });
  for (const doc of result.docs) {
    await db.remove(doc);
  }
}
