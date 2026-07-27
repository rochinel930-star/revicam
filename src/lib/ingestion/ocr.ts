// Étape 1 — OCR : binaire → texte. Phase P4.
// Passthrough si l'artefact est déjà textuel ; sinon délègue à l'adaptateur
// LLM (fournisseur bon marché). Sans adaptateur disponible, échoue proprement.

import { adapterActif } from '@/lib/ai/adapter';
import type { Artefact } from './types';

const MIMES_TEXTE = ['text/', 'application/markdown', 'application/json'];

export async function ocr(artefact: Artefact): Promise<string> {
  if (MIMES_TEXTE.some((m) => artefact.mime.startsWith(m))) {
    return artefact.contenu;
  }
  const ad = adapterActif();
  if (ad.disponible() && ad.ocr) {
    return ad.ocr(artefact);
  }
  throw new Error('OCR requis mais aucun adaptateur LLM disponible');
}
