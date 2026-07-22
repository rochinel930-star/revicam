// Rendu markdown → HTML, exécuté UNIQUEMENT côté serveur (SSG/ISR).
// Zéro JavaScript client pour afficher le contenu des cours.
//
// Syntaxe étendue : encadrés pédagogiques
//   :::formule Titre     → encadré bleu bordé navy
//   :::definition Titre  → encadré définition
//   :::exemple Titre     → encadré exemple résolu
// Le SVG inline et les tableaux markdown passent tels quels.

import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

const BOX_LABELS: Record<string, string> = {
  formule: 'Formule',
  definition: 'Définition',
  exemple: 'Exemple résolu',
};

function renderBoxes(src: string): string {
  return src.replace(
    /^:::(formule|definition|exemple)[ \t]*([^\n]*)\n([\s\S]*?)^:::[ \t]*$/gm,
    (_m, type: string, titre: string, corps: string) => {
      const label = titre.trim() || BOX_LABELS[type];
      const inner = marked.parse(corps.trim(), { async: false }) as string;
      return `<div class="box box-${type}"><p class="box-title">${label}</p>${inner}</div>`;
    }
  );
}

/** Rend un fragment markdown (contenu de leçon, énoncé, corrigé…) en HTML. */
export function mdToHtml(src: string | null | undefined): string {
  if (!src) return '';
  const withBoxes = renderBoxes(src);
  // Les <div class="box"> déjà rendus sont du HTML brut : marked les laisse passer.
  return marked.parse(withBoxes, { async: false }) as string;
}
