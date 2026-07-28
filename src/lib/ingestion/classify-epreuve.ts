// Classification d'épreuve à partir de l'EN-TÊTE — Phase P10 (ingestion en masse).
//
// STRATÉGIE COÛT MINIMAL : on classe d'abord par HEURISTIQUE DÉTERMINISTE
// (regex sur l'en-tête + nom de fichier) — GRATUIT, aucun appel IA. L'IA n'est
// sollicitée QUE si la confiance est insuffisante (cf. batch d'ingestion).
// On ne lit jamais l'épreuve entière : l'en-tête suffit à identifier
// matière / classe / série / type / séquence-trimestre / année / établissement.

import type { TypeEpreuve } from '@/lib/types';

export interface ChampsEpreuve {
  matiere: string | null; // slug normalisé (ex. 'mathematiques')
  niveau: string | null; // code niveau (ex. 'terminale', 'premiere', 'sixieme')
  serie: string | null; // 'A' | 'C' | 'D' | 'TI' …
  type: TypeEpreuve | null;
  numero_sequence: number | null;
  trimestre: number | null;
  annee: number | null;
  etablissement: string | null;
  session: string | null; // 'normale' | 'rattrapage'
}

export interface Classification {
  champs: ChampsEpreuve;
  confiance: number; // 0..1
  titre: string;
  manquants: string[]; // champs clés non résolus (pour la revue)
  source: 'heuristique' | 'ia' | 'fusion';
}

// ── Référentiels de reconnaissance ───────────────────────────────────
const MATIERES: Array<{ slug: string; re: RegExp }> = [
  { slug: 'mathematiques', re: /\bmath[ée]matiques?\b|\bmaths?\b/i },
  { slug: 'physique', re: /\bphysiques?\b|\bP\.?C\.?T\b/i },
  { slug: 'chimie', re: /\bchimie\b/i },
  { slug: 'svt', re: /\bS\.?V\.?T\.?E?\.?E?\.?H?\.?B?\b|sciences?\s+de\s+la\s+vie/i },
  { slug: 'francais', re: /\bfran[çc]ais\b/i },
  { slug: 'anglais', re: /\banglais\b|\benglish\b/i },
  { slug: 'philosophie', re: /\bphilosophie\b|\bphilo\b/i },
  { slug: 'histoire-geographie', re: /\bhistoire\b.*\bg[ée]ographie\b|\bhist[\s.-]*g[ée]o\b/i },
  { slug: 'histoire', re: /\bhistoire\b/i },
  { slug: 'geographie', re: /\bg[ée]ographie\b/i },
  { slug: 'informatique', re: /\binformatique\b|\bT\.?I\.?C\b/i },
  { slug: 'ecm', re: /\bE\.?C\.?M\.?\b|citoyennet[ée]/i },
  { slug: 'economie', re: /\b[ée]conomie\b/i },
];

const NIVEAUX: Array<{ code: string; re: RegExp }> = [
  { code: 'terminale', re: /\b(t(?:er)?m?(?:inale)?|tle|t\.?[abcd])\b/i },
  { code: 'premiere', re: /\b(1[èe]re|1re|premi[èe]re)\b/i },
  { code: 'seconde', re: /\b(2nde?|2de|seconde)\b/i },
  { code: 'troisieme', re: /\b3\s*(?:[èe]me|[èe])\b|troisi[èe]me/i },
  { code: 'quatrieme', re: /\b4\s*(?:[èe]me|[èe])\b|quatri[èe]me/i },
  { code: 'cinquieme', re: /\b5\s*(?:[èe]me|[èe])\b|cinqui[èe]me/i },
  { code: 'sixieme', re: /\b6\s*(?:[èe]me|[èe])\b|sixi[èe]me/i },
];

const SERIES = ['A1', 'A2', 'A3', 'A4', 'TI', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const TYPE_LABELS: Record<TypeEpreuve, string> = {
  sequentielle: 'Épreuve séquentielle',
  composition: 'Composition',
  blanc: 'Examen blanc',
  officiel: 'Sujet officiel',
  controle: 'Contrôle continu',
  bepc: 'BEPC',
  probatoire: 'Probatoire',
  baccalaureat: 'Baccalauréat',
  cep: 'CEP',
};

const NIVEAU_LABELS: Record<string, string> = {
  terminale: 'Terminale',
  premiere: 'Première',
  seconde: 'Seconde',
  troisieme: '3ᵉ',
  quatrieme: '4ᵉ',
  cinquieme: '5ᵉ',
  sixieme: '6ᵉ',
};

const MATIERE_LABELS: Record<string, string> = {
  mathematiques: 'Mathématiques',
  physique: 'Physique',
  chimie: 'Chimie',
  svt: 'SVTEEHB',
  francais: 'Français',
  anglais: 'Anglais',
  philosophie: 'Philosophie',
  histoire: 'Histoire',
  geographie: 'Géographie',
  'histoire-geographie': 'Histoire-Géographie',
  informatique: 'Informatique',
  ecm: 'ECM',
  economie: 'Économie',
};

const TYPES_OFFICIELS = ['bepc', 'probatoire', 'baccalaureat', 'cep'];

function trouver<T extends { re: RegExp }>(liste: T[], texte: string): T | null {
  return liste.find((x) => x.re.test(texte)) ?? null;
}

function detecterType(texte: string): { type: TypeEpreuve | null; seq: number | null; trim: number | null } {
  const t = texte.toLowerCase();
  const seqM = t.match(
    /s[ée]quence\s*n?[°o]?\s*(\d)|(\d)\s*[èe]?re?\s*s[ée]quence|[ée]valuation\s*n?[°o]?\s*(\d)|seq\.?\s*n?[°o]?\s*(\d)/i
  );
  const seq = seqM ? Number(seqM[1] ?? seqM[2] ?? seqM[3] ?? seqM[4]) : null;
  const trimM = t.match(/(\d)\s*(?:er|e|[èe]me)?\s*trimestre|trimestre\s*n?[°o]?\s*(\d)/i);
  const trim = trimM ? Number(trimM[1] ?? trimM[2]) : null;

  if (/bac(?:calaur[ée]at)?\s*blanc|probatoire\s*blanc|examen\s*blanc|blanc/i.test(t)) return { type: 'blanc', seq, trim };
  if (/baccalaur[ée]at\b/.test(t)) return { type: 'baccalaureat', seq, trim };
  if (/probatoire\b/.test(t)) return { type: 'probatoire', seq, trim };
  if (/\bbepc\b/.test(t)) return { type: 'bepc', seq, trim };
  if (/\bcep\b/.test(t)) return { type: 'cep', seq, trim };
  if (seq !== null) return { type: 'sequentielle', seq, trim };
  if (trim !== null || /composition/i.test(t)) return { type: 'composition', seq, trim };
  if (/contr[ôo]le/i.test(t)) return { type: 'controle', seq, trim };
  return { type: null, seq, trim };
}

function detecterEtablissement(texte: string): string | null {
  const m = texte.match(
    /\b(lyc[ée]e|coll[èe]ge|institut|complexe scolaire|groupe scolaire|C\.?E\.?S|C\.?E\.?T\.?I\.?C|G\.?B\.?H\.?S)\b[^\n,;.:]{2,45}/i
  );
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

/** Classe une épreuve à partir de son en-tête (déterministe, gratuit). */
export function classifierEntete(entete: string, nomFichier = ''): Classification {
  const texte = `${entete}\n${nomFichier.replace(/[_-]+/g, ' ')}`;

  const matiere = trouver(MATIERES, texte)?.slug ?? null;
  const niveau = trouver(NIVEAUX, texte)?.code ?? null;
  const serie = SERIES.find((s) => new RegExp(`\\b${s}\\b`).test(texte)) ?? null;
  const { type, seq, trim } = detecterType(texte);
  const anneeM = texte.match(/\b(20\d{2})\s*[-/]\s*20\d{2}\b|\b(20\d{2})\b/);
  const annee = anneeM ? Number(anneeM[1] ?? anneeM[2]) : null;
  const etablissement = detecterEtablissement(texte);
  const session = /rattrapage/i.test(texte) ? 'rattrapage' : /session\s*normale/i.test(texte) ? 'normale' : null;

  const champs: ChampsEpreuve = {
    matiere,
    niveau,
    serie,
    type,
    numero_sequence: type === 'sequentielle' ? seq : null,
    trimestre: trim,
    annee,
    etablissement,
    session,
  };

  // Confiance : matière (0.4) + niveau (0.3) + type (0.3). Bonus série/année.
  let confiance = 0;
  if (matiere) confiance += 0.4;
  if (niveau) confiance += 0.3;
  if (type) confiance += 0.3;
  confiance = Math.min(1, confiance);

  const manquants: string[] = [];
  if (!matiere) manquants.push('matiere');
  if (!niveau) manquants.push('niveau');
  if (!type) manquants.push('type');

  return { champs, confiance, titre: construireTitre(champs), manquants, source: 'heuristique' };
}

/**
 * Construit un nom d'affichage clair, dans la convention camerounaise
 * (MATIÈRE en tête), familière aux élèves :
 *   séquentiel : « SVTEEHB — Collège Mongo Beti — Séquence N°6 — 6ᵉ — 2025 »
 *   officiel   : « Mathématiques — Probatoire D — Session 2026 »
 */
export function construireTitre(c: ChampsEpreuve): string {
  const mat = c.matiere ? (MATIERE_LABELS[c.matiere] ?? c.matiere.replace(/-/g, ' ').replace(/^\w/, (x) => x.toUpperCase())) : 'Épreuve';
  const classe = c.niveau
    ? `${NIVEAU_LABELS[c.niveau] ?? c.niveau}${c.serie ? ' ' + c.serie : ''}`
    : c.serie
      ? `Série ${c.serie}`
      : null;

  const parts: (string | null)[] = [mat];

  if (c.type && TYPES_OFFICIELS.includes(c.type)) {
    parts.push(`${TYPE_LABELS[c.type]}${c.serie ? ' ' + c.serie : ''}`);
    if (c.annee) parts.push(`Session ${c.annee}`);
  } else {
    if (c.etablissement) parts.push(c.etablissement);
    if (c.type === 'sequentielle' && c.numero_sequence) parts.push(`Séquence N°${c.numero_sequence}`);
    else if (c.type === 'composition') parts.push(`Composition${c.trimestre ? ` ${c.trimestre}ᵉ trim.` : ''}`);
    else if (c.type === 'blanc') parts.push('Examen blanc');
    else if (c.type === 'controle') parts.push('Contrôle continu');
    if (classe) parts.push(classe);
    if (c.annee) parts.push(String(c.annee));
  }

  return parts.filter(Boolean).join(' — ') || 'Épreuve à classer';
}
