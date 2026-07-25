// Pipeline de rendu RéviCam — couche unified (remark/rehype).
// Exécuté UNIQUEMENT côté serveur (SSG/ISR) : zéro JavaScript client.
//
// Phases :
//   R1 → maths (remark-math + rehype-katex)  [à venir]
//   R2 → assainissement (rehype-sanitize)    [ACTIF]
//   R5 → blocs pédagogiques natifs (remark-directive)  [à venir]
//
// Étapes actuelles :
//   remark-parse      → AST Markdown (mdast)
//   remark-gfm        → tableaux, listes de tâches, ~barré~, autoliens
//   remark-rehype     → mdast → hast, en laissant passer le HTML brut
//   rehype-raw        → réintègre le HTML brut (SVG inline, <div> d'encadrés) dans le hast
//   rehype-sanitize   → défense en profondeur : liste blanche stricte
//                       (voir sanitize-schema.ts). Retire script, iframe,
//                       object, embed, on*, style, protocoles dangereux.
//   rehype-stringify  → hast → chaîne HTML
//
// ORDRE CRITIQUE : l'assainissement est la DERNIÈRE transformation hast, après
// rehype-raw. Le futur rehype-katex (R1) devra s'insérer ENTRE rehype-raw et
// rehype-sanitize (le schéma autorise déjà la sortie MathML de KaTeX).

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { revicamSchema } from './sanitize-schema';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  // R1 : rehype-katex (remark-math) s'insérera ICI, avant l'assainissement.
  .use(rehypeSanitize, revicamSchema)
  .use(rehypeStringify);

/** Rend un fragment Markdown (+ GFM + HTML brut) en HTML. Synchrone, côté serveur. */
export function markdownToHtml(src: string): string {
  return String(processor.processSync(src));
}
