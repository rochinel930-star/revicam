// Intégration artefacts de leçon — Phase P8 (PGlite).
// Prouve : vue publique (payload only, leçons publiées), secret-by-default
// (base secrète, `secret` jamais exposé), mutualisation (clé unique).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, type TestDb } from './harness';

let t: TestDb;
async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await t.db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  t = await setupDb();
  await t.db.exec(`
    insert into matieres (slug, nom, couleur_hex) values ('physique','Physique','#1A237E');
    insert into classes (slug, nom, ordre, programme_id)
      select 'premiere-d','Première D',50, id from programme where code='cameroun-minesec';
    insert into modules (classe_id, matiere_id, numero, titre)
      select c.id, m.id, 1, 'Mesure' from classes c, matieres m where c.slug='premiere-d' and m.slug='physique';
    -- leçon publiée + leçon brouillon
    insert into lecons (module_id, numero, titre, slug, objectifs, contenu_mdx, publie)
      select id, 1, 'Publiee', 'pub', '[]'::jsonb, '# x', true from modules where titre='Mesure';
    insert into lecons (module_id, numero, titre, slug, objectifs, contenu_mdx, publie)
      select id, 2, 'Brouillon', 'brou', '[]'::jsonb, '# y', false from modules where titre='Mesure';
    -- artefacts (avec secret) pour chacune
    insert into lesson_artifact (lecon_id, type, signature, lesson_version, prompt_version, payload, secret)
      select id, 'questions_ouvertes', 'sig-pub', 'lv1', 'qo-1',
             '[{"question_mdx":"Q","bareme":4}]'::jsonb, '[{"corrige_type_mdx":"SECRET","bareme":4}]'::jsonb
      from lecons where slug='pub';
    insert into lesson_artifact (lecon_id, type, signature, lesson_version, prompt_version, payload, secret)
      select id, 'qcm', 'sig-brou', 'lv1', 'qcm-1', '[]'::jsonb, null
      from lecons where slug='brou';
  `);
}, 60_000);

afterAll(async () => {
  if (t) await t.close();
});

describe('P8 — lesson_artifact', () => {
  it('la vue publique expose le payload des leçons publiées uniquement', async () => {
    await t.asRole('anon');
    const rows = await q<{ type: string }>(`select type from lesson_artifact_public`);
    expect(rows).toHaveLength(1); // seulement l'artefact de la leçon publiée
    expect(rows[0].type).toBe('questions_ouvertes');
    await t.reset();
  });

  it('la vue n’expose jamais la colonne secret', async () => {
    const cols = (
      await q<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name='lesson_artifact_public'`
      )
    ).map((r) => r.column_name);
    expect(cols).not.toContain('secret');
    expect(cols).toContain('payload');
  });

  it('anon ne peut pas lire la table de base (secret-by-default)', async () => {
    await t.asRole('anon');
    await expect(q(`select * from lesson_artifact`)).rejects.toBeTruthy();
    await t.reset();
  });

  it('mutualisation : clé (lecon_id,type,signature) unique', async () => {
    await expect(
      t.db.exec(`
        insert into lesson_artifact (lecon_id, type, signature, lesson_version, prompt_version, payload)
        select id, 'questions_ouvertes', 'sig-pub', 'lv1', 'qo-1', '[]'::jsonb from lecons where slug='pub';
      `)
    ).rejects.toBeTruthy();
  });
});
