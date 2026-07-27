// Intégration staging d'ingestion — Phase P4 (PGlite).
// Prouve : schéma staging présent + secret-by-default (anon refusé, staff lit).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, type TestDb } from './harness';

let t: TestDb;
async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await t.db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  t = await setupDb();
  await t.db.exec(`
    insert into ingestion_job (source, type, statut, content_hash)
      values ('sujet-bac.pdf', 'epreuve', 'valide', 'abcd1234');
    insert into ingestion_extraction (job_id, payload, score)
      select id, '{"titre":"x"}'::jsonb, 0.8 from ingestion_job where content_hash = 'abcd1234';
    insert into ingestion_review (job_id) select id from ingestion_job where content_hash = 'abcd1234';
  `);
}, 60_000);

afterAll(async () => {
  if (t) await t.close();
});

describe('P4 — staging', () => {
  it('crée les 4 tables ingestion_*', async () => {
    const rels = (
      await q<{ relname: string }>(
        `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
         and relname like 'ingestion_%'`
      )
    ).map((r) => r.relname).sort();
    expect(rels).toEqual(['ingestion_artifact', 'ingestion_extraction', 'ingestion_job', 'ingestion_review']);
  });

  it('empreinte unique → idempotence (insert doublon rejeté)', async () => {
    await expect(
      t.db.exec(
        `insert into ingestion_job (source, type, statut, content_hash) values ('x','epreuve','valide','abcd1234');`
      )
    ).rejects.toBeTruthy();
  });

  it('secret-by-default : anon ne lit pas le staging', async () => {
    await t.asRole('anon');
    await expect(q(`select * from ingestion_job`)).rejects.toBeTruthy();
    await t.reset();
  });

  it('staff lit le staging ; non-staff ne voit rien', async () => {
    const uid = (
      await q<{ id: string }>(`insert into auth.users (email) values ('op@revicam.cm') returning id`)
    )[0].id;

    await t.asRole('authenticated', uid); // non-staff
    expect((await q(`select 1 from ingestion_job`)).length).toBe(0);
    await t.reset();

    await t.db.query(`insert into staff (user_id) values ($1)`, [uid]);
    await t.asRole('authenticated', uid); // staff
    expect((await q(`select 1 from ingestion_job`)).length).toBe(1);
    await t.reset();
  });
});
