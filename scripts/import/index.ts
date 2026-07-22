// ═══════════════════════════════════════════════════════════════════
// RéviCam — pipeline d'import de contenu
//
//   npm run import                  → valide puis écrit dans Supabase
//                                     (exige SUPABASE_SERVICE_ROLE_KEY)
//   npm run import -- --dry-run     → valide seulement, n'écrit rien
//   npm run import -- --sql out.sql → valide puis génère le SQL idempotent
//
// Formats de contenu : voir /content/README.md
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { parseLecon } from './parse-lecon';
import { parseComposition } from './parse-composition';
import { parseEpreuves } from './parse-epreuves';
import { SupabaseWriter, SqlWriter, type Writer } from './writer';
import type { StructureImport, LeconImport, CompositionImport, EpreuveImport, ImportError } from './types';

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');

dotenv.config({ path: path.join(ROOT, '.env.local') });

function walk(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

function rel(p: string): string {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sqlIdx = args.indexOf('--sql');
  const sqlFile = sqlIdx !== -1 ? args[sqlIdx + 1] : null;
  if (sqlIdx !== -1 && !sqlFile) {
    console.error('Usage : npm run import -- --sql <fichier-sortie.sql>');
    process.exit(1);
  }

  const errors: ImportError[] = [];

  // ── 1. Parse + validation ────────────────────────────────────────
  let structure: StructureImport | null = null;
  const structurePath = path.join(CONTENT, 'structure.json');
  if (fs.existsSync(structurePath)) {
    try {
      structure = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
    } catch (e) {
      errors.push({ fichier: 'content/structure.json', message: `JSON invalide : ${(e as Error).message}` });
    }
  }

  const lecons: LeconImport[] = [];
  for (const f of walk(path.join(CONTENT, 'lecons'), '.mdx')) {
    const parsed = parseLecon(fs.readFileSync(f, 'utf8'), rel(f), errors);
    if (parsed) lecons.push(parsed);
  }

  const compositions: CompositionImport[] = [];
  for (const f of walk(path.join(CONTENT, 'compositions'), '.json')) {
    const parsed = parseComposition(fs.readFileSync(f, 'utf8'), rel(f), errors);
    if (parsed) compositions.push(parsed);
  }

  let epreuves: EpreuveImport[] = [];
  const csvPath = path.join(CONTENT, 'epreuves', 'epreuves.csv');
  if (fs.existsSync(csvPath)) {
    epreuves = parseEpreuves(fs.readFileSync(csvPath, 'utf8'), rel(csvPath), errors);
  }

  const total = lecons.length + compositions.length + epreuves.length;
  console.log(`Contenu détecté : ${lecons.length} leçon(s), ${compositions.length} composition(s), ${epreuves.length} épreuve(s).`);

  if (errors.length > 0) {
    console.error(`\n✖ ${errors.length} erreur(s) de validation — rien n'a été importé :\n`);
    for (const e of errors) console.error(`  • ${e.fichier}\n    ${e.message}`);
    process.exit(1);
  }
  if (total === 0 && !structure) {
    console.log('Rien à importer.');
    return;
  }
  console.log('✔ Validation OK.');
  if (dryRun) {
    console.log('(--dry-run : aucune écriture effectuée)');
    return;
  }

  // ── 2. Écriture ──────────────────────────────────────────────────
  let writer: Writer;
  if (sqlFile) {
    writer = new SqlWriter(path.resolve(sqlFile));
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error(
        '\n✖ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local.\n' +
        '  (La clé service_role se trouve dans le dashboard Supabase → Settings → API.)\n' +
        '  Alternative sans clé : npm run import -- --sql seed.sql, puis coller le fichier dans l\'éditeur SQL du dashboard.'
      );
      process.exit(1);
    }
    writer = new SupabaseWriter(url, key, CONTENT);
  }

  try {
    if (structure) await writer.importStructure(structure);
    for (const l of lecons) await writer.importLecon(l);
    for (const c of compositions) await writer.importComposition(c);
    for (const e of epreuves) await writer.importEpreuve(e);
    await writer.finish();
  } catch (err) {
    if (writer.erreurs.length === 0) {
      writer.erreurs.push({ fichier: '?', message: (err as Error).message });
    }
  }

  if (writer.erreurs.length > 0) {
    console.error(`\n✖ Import interrompu :\n`);
    for (const e of writer.erreurs) console.error(`  • ${e.fichier}\n    ${e.message}`);
    process.exit(1);
  }

  if (sqlFile) {
    console.log(`✔ SQL généré : ${sqlFile} (${writer.crees} objet(s)) — à exécuter dans l'éditeur SQL Supabase.`);
  } else {
    console.log(`✔ Import terminé : ${writer.crees} créé(s), ${writer.maj} mis à jour, 0 erreur.`);
  }
}

main().catch((e) => {
  console.error('Erreur inattendue :', e);
  process.exit(1);
});
