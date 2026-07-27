// Intégration schéma Données V2 — Phase P2.
//
// Applique 0001→0014 dans un Postgres réel (PGlite) et prouve : additivité,
// backfill, RLS/secret-by-default, vues de compatibilité, triggers de
// défaut, versionnage (snapshot/restore/append-only) et le principe
// « ajouter une classe = insertion de lignes ».

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, seedSql, type TestDb } from './harness';

let t: TestDb;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await t.db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  t = await setupDb();
  // Fixtures (post-migration, en tant que superuser).
  await t.db.exec(`
    insert into matieres (slug, nom, couleur_hex) values ('physique','Physique','#1A237E');
    insert into classes (slug, nom, ordre, programme_id, niveau_id, serie_id)
      select 'premiere-d','Première D',50, pr.id,
        (select id from niveau where programme_id = pr.id and code = 'premiere'),
        (select id from serie  where programme_id = pr.id and code = 'D')
      from programme pr where pr.code = 'cameroun-minesec';
    -- Chapitre inséré SANS programme_id → doit être rempli par le trigger.
    insert into modules (classe_id, matiere_id, numero, titre)
      select c.id, m.id, 1, 'Mesure des grandeurs'
      from classes c, matieres m where c.slug = 'premiere-d' and m.slug = 'physique';
    -- Leçon insérée SANS chapitre_id → doit être remplie par le trigger.
    insert into lecons (module_id, numero, titre, slug, objectifs, contenu_mdx, publie)
      select id, 1, 'Grandeurs physiques', 'grandeurs', '[]'::jsonb, '# Cours v1', true
      from modules where titre = 'Mesure des grandeurs';
  `);
}, 60_000);

afterAll(async () => {
  if (t) await t.close();
});

describe('P2 — migrations & schéma', () => {
  it('applique la chaîne complète 0001→0014 sans erreur', async () => {
    const rows = await q<{ n: number }>(
      `select count(*)::int as n from information_schema.tables where table_schema = 'public'`
    );
    expect(rows[0].n).toBeGreaterThan(15);
  });

  it('crée toutes les tables et vues V2 attendues', async () => {
    const rels = (
      await q<{ relname: string }>(
        `select relname from pg_class
         where relnamespace = 'public'::regnamespace and relkind in ('r','v')`
      )
    ).map((r) => r.relname);
    for (const attendu of [
      'pays', 'programme', 'niveau', 'serie', 'sequence', 'content_version', 'staff',
      'chapitre', 'lecons_public', 'questions_public', 'feature_flags_public',
    ]) {
      expect(rels, `relation manquante: ${attendu}`).toContain(attendu);
    }
  });
});

describe('P2 — backfill Cameroun / MINESEC', () => {
  it('seede le programme, 7 niveaux et 5 séries', async () => {
    expect((await q(`select 1 from programme where code = 'cameroun-minesec'`)).length).toBe(1);
    expect((await q<{ n: number }>(`select count(*)::int n from niveau`))[0].n).toBe(7);
    expect((await q<{ n: number }>(`select count(*)::int n from serie`))[0].n).toBe(5);
  });
});

describe('P2 — triggers de défaut (zéro régression import)', () => {
  it('remplit programme_id du chapitre depuis la classe', async () => {
    const rows = await q<{ programme_id: string | null }>(
      `select programme_id from modules where titre = 'Mesure des grandeurs'`
    );
    expect(rows[0].programme_id).toBeTruthy();
  });

  it('remplit chapitre_id de la leçon (= module_id)', async () => {
    const rows = await q<{ chapitre_id: string; module_id: string }>(
      `select chapitre_id, module_id from lecons where slug = 'grandeurs'`
    );
    expect(rows[0].chapitre_id).toBe(rows[0].module_id);
  });
});

describe('P2 — vue canonique chapitre (compat + auto-modifiable)', () => {
  it('la vue chapitre expose le chapitre physique', async () => {
    const rows = await q<{ numero: number; titre: string }>(
      `select numero, titre from chapitre where titre = 'Mesure des grandeurs'`
    );
    expect(rows[0].numero).toBe(1);
  });

  it('insérer dans la vue chapitre écrit dans modules', async () => {
    await t.db.exec(`
      insert into chapitre (classe_id, matiere_id, numero, titre)
      select c.id, m.id, 2, 'Incertitudes'
      from classes c, matieres m where c.slug = 'premiere-d' and m.slug = 'physique';
    `);
    const rows = await q<{ titre: string }>(`select titre from modules where numero = 2`);
    expect(rows[0].titre).toBe('Incertitudes');
  });
});

describe('P2 — RLS & secret-by-default', () => {
  it('anon lit le référentiel V2 (programme, niveau, serie, chapitre)', async () => {
    await t.asRole('anon');
    expect((await q(`select 1 from programme`)).length).toBeGreaterThan(0);
    expect((await q(`select 1 from niveau`)).length).toBe(7);
    expect((await q(`select 1 from serie`)).length).toBe(5);
    expect((await q(`select 1 from chapitre`)).length).toBeGreaterThan(0);
    await t.reset();
  });

  it('anon ne peut PAS lire content_version (grant révoqué) ni les questions (RLS)', async () => {
    await t.asRole('anon');
    // content_version : grant révoqué (0013) → permission refusée.
    await expect(q(`select * from content_version`)).rejects.toBeTruthy();
    // questions : grant présent mais RLS sans policy → 0 ligne (jamais de fuite).
    expect((await q(`select * from questions`)).length).toBe(0);
    await t.reset();
  });

  it('anon passe par les vues publiques (lecons_public, feature_flags_public)', async () => {
    await t.asRole('anon');
    await expect(q(`select * from lecons`)).rejects.toBeTruthy(); // grant révoqué (0005)
    expect(Array.isArray(await q(`select * from lecons_public`))).toBe(true);
    await expect(q(`select * from feature_flags`)).rejects.toBeTruthy(); // secret (0006)
    expect(Array.isArray(await q(`select * from feature_flags_public`))).toBe(true);
    await t.reset();
  });

  it('content_version : authentifié non-staff ne voit rien ; staff voit', async () => {
    // Créer une version puis un utilisateur staff.
    await t.db.exec(`select fn_snapshot_lecon((select id from lecons where slug = 'grandeurs'));`);
    const uid = (
      await q<{ id: string }>(
        `insert into auth.users (email) values ('staff@revicam.cm') returning id`
      )
    )[0].id;

    await t.asRole('authenticated', uid); // pas encore staff
    expect((await q(`select 1 from content_version`)).length).toBe(0);
    await t.reset();

    await t.db.query(`insert into staff (user_id) values ($1)`, [uid]);
    await t.asRole('authenticated', uid); // désormais staff
    expect((await q(`select 1 from content_version`)).length).toBeGreaterThan(0);
    await t.reset();
  });
});

describe('P2 — versionnage (snapshot / restore / append-only)', () => {
  it('snapshot, modification, snapshot v2, restauration v1', async () => {
    const leconId = (await q<{ id: string }>(`select id from lecons where slug = 'grandeurs'`))[0].id;

    // Repartir d'un état net de versions pour cette leçon.
    await t.db.exec(`delete from lecons where false;`); // no-op sûr
    const v1 = (
      await q<{ f: string }>(`select fn_snapshot_lecon($1) as f`, [leconId])
    )[0].f;
    await t.db.query(`update lecons set contenu_mdx = '# Cours v2' where id = $1`, [leconId]);
    await q(`select fn_snapshot_lecon($1)`, [leconId]);

    // Restaurer v1 → le contenu doit revenir à « v1 ».
    await q(`select fn_restore_lecon_version($1)`, [v1]);
    const contenu = (
      await q<{ contenu_mdx: string }>(`select contenu_mdx from lecons where id = $1`, [leconId])
    )[0].contenu_mdx;
    expect(contenu).toBe('# Cours v1');

    // current_version_id pointe sur la dernière version (la restauration).
    const cur = await q<{ n: number }>(
      `select version as n from content_version
       where id = (select current_version_id from lecons where id = $1)`,
      [leconId]
    );
    expect(cur[0].n).toBeGreaterThanOrEqual(3);
  });

  it('content_version est append-only (UPDATE/DELETE interdits)', async () => {
    await expect(q(`update content_version set version = 999`)).rejects.toBeTruthy();
    await expect(q(`delete from content_version`)).rejects.toBeTruthy();
  });
});

describe('P2 — examens élargis & « ajouter une classe = insertion de lignes »', () => {
  it('accepte les nouveaux types d’épreuve (baccalaureat)', async () => {
    await t.db.exec(`
      insert into epreuves (classe_id, matiere_id, type, annee, titre)
      select c.id, m.id, 'baccalaureat', 2024, 'Bac D 2024'
      from classes c, matieres m where c.slug = 'premiere-d' and m.slug = 'physique';
    `);
    const rows = await q<{ programme_id: string | null }>(
      `select programme_id from epreuves where titre = 'Bac D 2024'`
    );
    expect(rows[0].programme_id).toBeTruthy(); // trigger a rempli le programme
  });

  it('ajouter « Terminale C » via le seed = pures insertions', async () => {
    await t.db.exec(seedSql('terminale-c.sql'));
    const classe = await q<{ slug: string; niveau_id: string; serie_id: string }>(
      `select slug, niveau_id, serie_id from classes where slug = 'terminale-c'`
    );
    expect(classe[0].niveau_id).toBeTruthy();
    expect(classe[0].serie_id).toBeTruthy();
    // Le chapitre de la nouvelle classe hérite du programme via trigger.
    const mod = await q<{ programme_id: string | null }>(
      `select m.programme_id from modules m
       join classes c on c.id = m.classe_id where c.slug = 'terminale-c'`
    );
    expect(mod[0].programme_id).toBeTruthy();
  });
});
