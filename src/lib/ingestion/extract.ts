// Étape 2 — extraction : texte → JSON canonique. Phase P4.
// Si l'entrée est déjà du JSON canonique, on le parse (chemin sans IA, gratuit) ;
// sinon on délègue l'extraction structurée à l'adaptateur LLM bon marché.

import { adapterActif } from '@/lib/ai/adapter';

export async function extraire(texte: string, type: string): Promise<unknown> {
  const t = texte.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t);
    } catch {
      /* pas du JSON valide : on tente l'IA ci-dessous */
    }
  }
  const ad = adapterActif();
  if (ad.disponible() && ad.extraire) {
    return ad.extraire(texte, type);
  }
  throw new Error('Extraction requise mais aucun adaptateur LLM disponible');
}
