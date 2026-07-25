// Schéma d'assainissement du pipeline de rendu (R2 — défense en profondeur).
//
// Principe : liste blanche stricte étendant `defaultSchema` de rehype-sanitize.
// Tout ce qui n'est pas explicitement autorisé est retiré. On part du socle
// sûr (GFM : titres, paragraphes, listes, tableaux, blockquotes, code, liens
// à protocoles sûrs — javascript: est déjà exclu) et on n'ajoute QUE :
//   1. les encadrés RéviCam  : <div class="box …"> / <p class="box-title">
//   2. le SVG éditorial       : formes statiques réellement utilisées par les
//                               leçons (svg/line/rect/polygon/path/text…),
//                               attributs de présentation seulement.
//   3. MathML (compatibilité KaTeX, R1) : KaTeX sera configuré en sortie
//                               MathML, qui ne requiert AUCUN style inline.
//
// Volontairement ABSENTS (donc supprimés) : script, iframe, object, embed,
// foreignObject, use, a dans SVG, tous les gestionnaires on* (non listés donc
// retirés), l'attribut `style` (le contenu éditorial n'en a aucun — vérifié —
// et « styles dangereux » ⇒ on bloque `style` entièrement), les protocoles
// dangereux (javascript:/data: hors socle sûr).
//
// Noms d'attributs = propriétés hast (camelCase pour le SVG multi-mots :
// strokeWidth, viewBox, fontSize…). Conformité vérifiée empiriquement sur le
// contenu réel (aucune régression sur les leçons publiées).

import { defaultSchema } from 'rehype-sanitize';

// Formes SVG statiques sûres (superset minimal du réellement utilisé + frères
// géométriques évidents, tous purement présentationnels).
const SVG_TAGS = [
  'svg', 'g', 'line', 'rect', 'circle', 'ellipse',
  'polygon', 'polyline', 'path', 'text', 'tspan', 'title', 'desc',
];

// Éléments MathML émis par KaTeX (sortie MathML) — pour R1.
const MATHML_TAGS = [
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms',
  'mtext', 'mspace', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot',
  'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mstyle',
  'mpadded', 'mphantom', 'menclose', 'merror',
];

// Attributs de présentation SVG communs (jamais exécutables).
const SVG_PRESENTATION = [
  'fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLinecap',
  'strokeLinejoin', 'transform', 'opacity', 'fillOpacity', 'strokeOpacity',
];

const base = defaultSchema;

export const revicamSchema = {
  ...base,
  // Élément entièrement supprimé (contenu compris), pas seulement « dé-wrappé ».
  strip: ['script', 'style', 'foreignObject'],
  tagNames: [
    ...(base.tagNames ?? []),
    'div', 'span',
    ...SVG_TAGS,
    ...MATHML_TAGS,
  ],
  attributes: {
    ...base.attributes,
    // Attributs sûrs autorisés partout (jamais de style, jamais de on*).
    '*': [
      ...((base.attributes && base.attributes['*']) ?? []),
      'className', 'ariaHidden', 'ariaLabel', 'role',
    ],
    div: [...((base.attributes && base.attributes.div) ?? []), 'className'],
    p: [...((base.attributes && base.attributes.p) ?? []), 'className'],
    span: [...((base.attributes && base.attributes.span) ?? []), 'className'],

    // ── SVG éditorial (présentation seulement) ──────────────────────
    svg: ['viewBox', 'xmlns', 'width', 'height', 'role', 'ariaLabel', 'className'],
    g: [...SVG_PRESENTATION],
    line: ['x1', 'y1', 'x2', 'y2', ...SVG_PRESENTATION],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', ...SVG_PRESENTATION],
    circle: ['cx', 'cy', 'r', ...SVG_PRESENTATION],
    ellipse: ['cx', 'cy', 'rx', 'ry', ...SVG_PRESENTATION],
    polygon: ['points', ...SVG_PRESENTATION],
    polyline: ['points', ...SVG_PRESENTATION],
    path: ['d', ...SVG_PRESENTATION],
    text: ['x', 'y', 'dx', 'dy', 'fontSize', 'fontWeight', 'fontFamily', 'textAnchor', ...SVG_PRESENTATION],
    tspan: ['x', 'y', 'dx', 'dy', 'fontSize', 'fontWeight', 'textAnchor', ...SVG_PRESENTATION],

    // ── MathML (KaTeX, R1) ──────────────────────────────────────────
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
    mo: ['stretchy', 'fence', 'separator', 'form', 'largeop', 'movablelimits', 'accent', 'lspace', 'rspace'],
    mspace: ['width', 'height', 'depth'],
    mpadded: ['width', 'height', 'depth', 'lspace', 'voffset'],
    menclose: ['notation'],
  },
};
