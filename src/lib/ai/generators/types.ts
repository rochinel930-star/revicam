// Contrat commun des générateurs d'artefacts de leçon — Phase P8.

import type { LessonContext } from '@/lib/lesson-context';
import type { TypeArtefactLecon } from '@/lib/types';
import type { Palier } from '../cost';

export interface ResultatValidationArtefact {
  ok: boolean;
  problemes: string[];
  payload?: unknown; // partie publique (servie à l'élève)
  secret?: unknown; // partie secrète (rubriques) — server-only
}

export interface Generateur {
  type: TypeArtefactLecon;
  /** Version du prompt : entre dans la signature de cache. */
  promptVersion: string;
  /** Palier de coût IA de la génération. */
  palier: Palier;
  /** Construit l'instruction envoyée à l'adaptateur LLM. */
  construirePrompt(ctx: LessonContext): string;
  /** Valide DÉTERMINISTIQUEMENT la sortie brute du LLM → payload canonique. */
  valider(raw: unknown): ResultatValidationArtefact;
}

// ── Helpers de validation partagés ───────────────────────────────────
export function estTableau(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
export function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
export function chaineNonVide(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
