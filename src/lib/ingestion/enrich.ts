// Étape 7 — enrichissement : suggestions de liens au graphe. Phase P4.
// Heuristique déterministe : propose les notions dont le nom apparaît dans le
// document source ou les énoncés. SUGGESTIONS uniquement — le rattachement
// définitif est validé par un humain (l'IA propose, l'humain approuve).

import type { ExtractionEpreuve } from './types';

export interface NotionConnue {
  code: string;
  nom: string;
}

export function enrichir(
  extraction: ExtractionEpreuve,
  source: string,
  notionsConnues: NotionConnue[]
): string[] {
  const texte = (source + ' ' + extraction.questions.map((q) => q.enonce_mdx).join(' ')).toLowerCase();
  const codes = notionsConnues
    .filter((n) => n.nom.trim().length >= 3 && texte.includes(n.nom.toLowerCase()))
    .map((n) => n.code);
  return [...new Set(codes)];
}
