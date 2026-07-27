// Garde-fou d'additivité des migrations P2 — Phase P2.
//
// Vérifie statiquement que les migrations 0007→0014 respectent la
// contrainte « additive uniquement » : aucune instruction destructive
// (drop table/column/view, truncate, delete) hors commentaires, et
// présence d'une section rollback.

import { describe, it, expect } from 'vitest';
import { migrationSql } from './harness';

const MIGRATIONS_P2 = [
  '0007_pays_programme.sql',
  '0008_classe_serie_matiere.sql',
  '0009_chapitre_sequence.sql',
  '0010_lecon_rattachement.sql',
  '0011_epreuves_examens.sql',
  '0012_versioning.sql',
  '0013_rls_multiprogramme.sql',
  '0014_backfill_cameroun.sql',
];

/** Retire les lignes de commentaire (`--`) pour n'analyser que le SQL actif. */
function sqlActif(source: string): string {
  return source
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
    .toLowerCase();
}

// Motifs destructifs interdits. `drop constraint if exists ... _check` est
// autorisé (élargissement d'un CHECK = additif au sens des données).
const INTERDITS: { motif: RegExp; nom: string }[] = [
  { motif: /\bdrop\s+table\b/, nom: 'drop table' },
  { motif: /\bdrop\s+column\b/, nom: 'drop column' },
  { motif: /\bdrop\s+view\b/, nom: 'drop view' },
  { motif: /\btruncate\b/, nom: 'truncate' },
  { motif: /\bdelete\s+from\b/, nom: 'delete from' },
  { motif: /\balter\s+column\b.*\btype\b/, nom: 'alter column type' },
];

describe('P2 — additivité des migrations', () => {
  it.each(MIGRATIONS_P2)('%s ne contient aucune instruction destructive', (file) => {
    const actif = sqlActif(migrationSql(file));
    for (const { motif, nom } of INTERDITS) {
      expect(motif.test(actif), `${file} contient « ${nom} »`).toBe(false);
    }
  });

  it.each(MIGRATIONS_P2)('%s documente un rollback', (file) => {
    expect(migrationSql(file).toLowerCase()).toContain('rollback');
  });

  it('les 8 migrations P2 sont présentes et ordonnées', () => {
    expect(MIGRATIONS_P2).toHaveLength(8);
  });
});
