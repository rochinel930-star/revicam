// Intégration graphe de connaissances — Phase P3 (PGlite).
//
// Prouve : traversée notion → chapitre → classe → programme → pays,
// unicité de foyer (une notion = un chapitre), et secret-by-default de
// question_notion.

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
    insert into classes (slug, nom, ordre, programme_id, niveau_id, serie_id)
      select 'premiere-d','Première D',50, pr.id,
        (select id from niveau where programme_id = pr.id and code = 'premiere'),
        (select id from serie  where programme_id = pr.id and code = 'D')
      from programme pr where pr.code = 'cameroun-minesec';
    insert into modules (classe_id, matiere_id, numero, titre)
      select c.id, m.id, 1, 'Mesure'
      from classes c, matieres m where c.slug = 'premiere-d' and m.slug = 'physique';
    insert into lecons (module_id, numero, titre, slug, objectifs, contenu_mdx, publie)
      select id, 1, 'Grandeurs', 'grandeurs', '[]'::jsonb, '# Cours', true
      from modules where titre = 'Mesure';
    insert into notion (programme_id, chapitre_id, code, nom)
      select m.programme_id, m.id, 'unites', 'Unités de mesure'
      from modules m where m.titre = 'Mesure';
    insert into competence (programme_id, code, nom, domaine)
      select id, 'mesurer', 'Mesurer une grandeur', 'expérimental'
      from programme where code = 'cameroun-minesec';
    insert into lecon_notion (lecon_id, notion_id)
      select l.id, n.id from lecons l, notion n where l.slug = 'grandeurs' and n.code = 'unites';
    insert into notion_competence (notion_id, competence_id)
      select n.id, c.id from notion n, competence c where n.code = 'unites' and c.code = 'mesurer';
  `);
}, 60_000);

afterAll(async () => {
  if (t) await t.close();
});

describe('P3 — traversée du graphe', () => {
  it('remonte notion → chapitre → classe → programme → pays', async () => {
    const rows = await q<{ pays_code: string; programme_code: string; classe_slug: string }>(
      `select pays_code, programme_code, classe_slug from v_notion_chaine where notion_code = 'unites'`
    );
    expect(rows[0].pays_code).toBe('CM');
    expect(rows[0].programme_code).toBe('cameroun-minesec');
    expect(rows[0].classe_slug).toBe('premiere-d');
  });

  it('relie leçon → notion → compétence', async () => {
    const rows = await q<{ nom: string }>(`
      select c.nom from lecon_notion ln
      join notion_competence nc on nc.notion_id = ln.notion_id
      join competence c on c.id = nc.competence_id
      where ln.lecon_id = (select id from lecons where slug = 'grandeurs')
    `);
    expect(rows[0].nom).toBe('Mesurer une grandeur');
  });
});

describe('P3 — foyer unique & sécurité', () => {
  it('interdit deux notions de même code dans un chapitre (unicité foyer)', async () => {
    await expect(
      t.db.exec(`
        insert into notion (programme_id, chapitre_id, code, nom)
        select m.programme_id, m.id, 'unites', 'Doublon'
        from modules m where m.titre = 'Mesure';
      `)
    ).rejects.toBeTruthy();
  });

  it('anon lit notion/competence/v_notion_chaine mais pas question_notion', async () => {
    await t.asRole('anon');
    expect((await q(`select 1 from notion`)).length).toBeGreaterThan(0);
    expect((await q(`select 1 from competence`)).length).toBeGreaterThan(0);
    expect((await q(`select 1 from v_notion_chaine`)).length).toBeGreaterThan(0);
    await expect(q(`select * from question_notion`)).rejects.toBeTruthy();
    await t.reset();
  });
});
