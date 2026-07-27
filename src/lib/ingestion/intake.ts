// Étape 0 — intake : empreinte + déduplication. Phase P4.

import { fnv1a } from '@/lib/hash';
import type { Artefact } from './types';

/** Calcule l'empreinte de contenu et l'attache à l'artefact. */
export function intake(artefact: Artefact): Artefact {
  const hash = fnv1a(`${artefact.type}:${artefact.mime}:${artefact.contenu}`);
  return { ...artefact, hash };
}

/** Vrai si l'empreinte est déjà connue (ré-ingestion → 0 doublon). */
export function estDoublon(hash: string, connus: Set<string>): boolean {
  return connus.has(hash);
}
