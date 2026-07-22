// Parseur du gabarit epreuves.csv (voir /content/README.md).
import type { EpreuveImport, ImportError } from './types';

const TYPES = ['sequentielle', 'composition', 'blanc', 'officiel', 'controle'];

/** Parseur CSV minimal : gère les champs entre guillemets et les virgules internes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const COLONNES = ['classe', 'matiere', 'type', 'numero_sequence', 'annee', 'serie', 'etablissement', 'titre', 'pdf', 'composable', 'composition_slug', 'lecons'];

export function parseEpreuves(raw: string, fichier: string, errors: ImportError[]): EpreuveImport[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = COLONNES.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push({ fichier, message: `Colonnes manquantes dans l'en-tête CSV : ${missing.join(', ')}` });
    return [];
  }
  const idx = Object.fromEntries(COLONNES.map((c) => [c, header.indexOf(c)]));
  const epreuves: EpreuveImport[] = [];
  for (let i = 1; i < lines.length; i++) {
    const pos = `ligne ${i + 1}`;
    const cells = parseCsvLine(lines[i]);
    const get = (c: string) => cells[idx[c]] ?? '';
    const type = get('type');
    if (!TYPES.includes(type)) {
      errors.push({ fichier, message: `${pos} : type « ${type} » invalide (attendu : ${TYPES.join(' | ')})` });
      continue;
    }
    const annee = Number(get('annee'));
    if (!Number.isInteger(annee) || annee < 2000) {
      errors.push({ fichier, message: `${pos} : année « ${get('annee')} » invalide` });
      continue;
    }
    if (!get('classe') || !get('matiere') || !get('titre')) {
      errors.push({ fichier, message: `${pos} : classe, matiere et titre sont obligatoires` });
      continue;
    }
    const composable = /^(true|1|oui)$/i.test(get('composable'));
    if (composable && !get('composition_slug')) {
      errors.push({ fichier, message: `${pos} : composable=true exige « composition_slug »` });
      continue;
    }
    epreuves.push({
      fichier: `${fichier} (${pos})`,
      classe: get('classe'),
      matiere: get('matiere'),
      type: type as EpreuveImport['type'],
      numero_sequence: get('numero_sequence') ? Number(get('numero_sequence')) : undefined,
      annee,
      serie: get('serie') || undefined,
      etablissement: get('etablissement') || undefined,
      titre: get('titre'),
      pdf: get('pdf') || undefined,
      composable,
      composition_slug: get('composition_slug') || undefined,
      lecons: get('lecons') ? get('lecons').split(';').map((s) => s.trim()).filter(Boolean) : [],
    });
  }
  return epreuves;
}
