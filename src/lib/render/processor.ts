// Pipeline de rendu RéviCam — couche unified (remark/rehype).
// Exécuté UNIQUEMENT côté serveur (SSG/ISR) : zéro JavaScript client.
//
// R0 (iso-comportement) : reproduit exactement le rendu Markdown+GFM+HTML brut
// de l'ancien moteur `marked`, mais sur le socle unified qui accueillera :
//   R1 → maths (remark-math + rehype-katex)
//   R2 → assainissement (rehype-sanitize)
//   R5 → blocs pédagogiques natifs (remark-directive)
// Aucune de ces étapes n'est présente ici : R0 n'ajoute AUCUN comportement.
//
// Étapes actuelles :
//   remark-parse      → AST Markdown (mdast)
//   remark-gfm        → tableaux, listes de tâches, ~barré~, autoliens
//   remark-rehype     → mdast → hast, en laissant passer le HTML brut
//   rehype-raw        → réintègre le HTML brut (SVG inline, <div> d'encadrés) dans le hast
//   rehype-stringify  → hast → chaîne HTML

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

/** Rend un fragment Markdown (+ GFM + HTML brut) en HTML. Synchrone, côté serveur. */
export function markdownToHtml(src: string): string {
  return String(processor.processSync(src));
}
