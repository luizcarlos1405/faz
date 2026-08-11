import { Temporal } from '@js-temporal/polyfill';
import { getDb, resetDb } from './database';
import { DOC_TYPE } from '$lib/types';

export interface FazExport {
  app: 'faz';
  exportedAt: string;
  docs: Record<string, unknown>[];
}

const isUserDoc = (doc: Record<string, unknown> | undefined): boolean =>
  !!doc && doc.type !== DOC_TYPE.ERROR.value;

export async function exportAllData(): Promise<FazExport> {
  const db = await getDb();
  const result = await db.allDocs({ include_docs: true });
  const docs = result.rows
    .filter(
      (row) =>
        !row.id.startsWith('_design/') && isUserDoc(row.doc as Record<string, unknown> | undefined),
    )
    .map((row) => row.doc as unknown as Record<string, unknown>);
  return {
    app: 'faz',
    exportedAt: Temporal.Now.instant().toString(),
    docs,
  };
}

export async function importData(data: FazExport): Promise<{ imported: number; skipped: number }> {
  const db = await getDb();
  const docs = data.docs.filter(isUserDoc).map((doc) => {
    const { _rev, ...rest } = doc;
    return rest;
  });
  const results = (await db.bulkDocs(docs as any[])) as Array<
    PouchDB.Core.Response | PouchDB.Core.Error
  >;
  const imported = results.filter((r): r is PouchDB.Core.Response => 'ok' in r).length;
  return { imported, skipped: results.length - imported };
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await db.destroy();
  resetDb();
}
