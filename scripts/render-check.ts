// Garde-fou de rendu (sans framework) — vérifie que l'API publique `mdToHtml`
// produit le HTML attendu sur les traits Markdown/GFM/HTML brut réellement
// utilisés par les leçons. Sert de filet anti-régression pour R0 puis R1+.
//
//   Lancement :  npx tsx scripts/render-check.ts    (ou  npm run render:check)
//   Sortie     :  code 0 si tout passe, code 1 sinon (utilisable en CI).

import { mdToHtml } from '../src/lib/markdown';

type Check = { nom: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function attendre(nom: string, ok: boolean, detail?: string) {
  checks.push({ nom, ok, detail });
}
function compte(h: string, re: RegExp): number {
  return (h.match(re) || []).length;
}

// ── 1. Cas vides : contrat de signature (null | undefined | '') → '' ──
attendre('null → chaîne vide', mdToHtml(null) === '');
attendre('undefined → chaîne vide', mdToHtml(undefined) === '');
attendre('vide → chaîne vide', mdToHtml('') === '');

// ── 2. Markdown de base ──────────────────────────────────────────────
{
  const h = mdToHtml('# Titre\n\nUn **gras** et de l’*italique*.');
  attendre('titre h1', /<h1>Titre<\/h1>/.test(h), h);
  attendre('gras', /<strong>gras<\/strong>/.test(h), h);
  attendre('italique', /<em>italique<\/em>/.test(h), h);
}

// ── 3. Listes ────────────────────────────────────────────────────────
{
  const h = mdToHtml('- un\n- deux\n- trois');
  attendre('liste : 3 <li>', compte(h, /<li>/g) === 3, h);
  attendre('liste : <ul>', /<ul>/.test(h), h);
}

// ── 4. Tableau GFM ───────────────────────────────────────────────────
{
  const h = mdToHtml('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
  attendre('tableau : <table>', /<table>/.test(h), h);
  attendre('tableau : <thead>', /<thead>/.test(h), h);
  attendre('tableau : 3 lignes <tr>', compte(h, /<tr>/g) === 3, h);
}

// ── 5. Encadrés pédagogiques :::formule / :::definition / :::exemple ──
{
  const h = mdToHtml(':::formule Travail\nW = F × d\n:::');
  attendre('encadré : div.box.box-formule', /<div class="box box-formule">/.test(h), h);
  attendre('encadré : titre explicite', /<p class="box-title">Travail<\/p>/.test(h), h);
}
{
  const h = mdToHtml(':::definition\nÉnergie du mouvement.\n:::');
  attendre('encadré : label par défaut', /<p class="box-title">Définition<\/p>/.test(h), h);
}
{
  const h = mdToHtml(':::exemple\nUn cas.\n:::');
  attendre('encadré : box-exemple', /<div class="box box-exemple">/.test(h), h);
}

// ── 6. SVG inline (HTML brut préservé) ───────────────────────────────
{
  const src = '<svg viewBox="0 0 10 10" role="img"><line x1="0" y1="0" x2="9" y2="9" stroke="#000"/></svg>';
  const h = mdToHtml(src);
  attendre('svg : balise préservée', /<svg[\s>]/.test(h), h);
  attendre('svg : enfant <line> préservé', /<line[\s>]/.test(h), h);
}

// ── 7. Sécurité : assainissement R2 (défense en profondeur) ──────────
{
  const h = mdToHtml('Bonjour <script>alert(1)</script> fin.');
  attendre('sécu : <script> et son contenu supprimés', !/<script/i.test(h) && !/alert\(1\)/.test(h), h);
}
{
  const h = mdToHtml('<img src=x onerror="alert(1)">');
  attendre('sécu : gestionnaire onerror supprimé', !/onerror/i.test(h), h);
}
{
  const h = mdToHtml('[clique](javascript:alert(1))');
  attendre('sécu : protocole javascript: supprimé', !/javascript:/i.test(h), h);
}
{
  const h = mdToHtml('<svg onload="alert(1)"><line x1="0" y1="0" x2="9" y2="9" stroke="red"/></svg>');
  attendre('sécu : SVG malveillant neutralisé (onload retiré, svg conservé)', !/onload/i.test(h) && /<svg/.test(h) && /<line/.test(h), h);
}
{
  const h = mdToHtml('<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>');
  attendre('sécu : foreignObject + iframe supprimés', !/foreignObject/i.test(h) && !/<iframe/i.test(h), h);
}
{
  const h = mdToHtml('<div style="background:url(javascript:alert(1))">x</div>');
  attendre('sécu : style inline supprimé', !/style=/i.test(h), h);
}
{
  const h = mdToHtml('<object data="x"></object><embed src="y">');
  attendre('sécu : object/embed supprimés', !/<object|<embed/i.test(h), h);
}
// HTML autorisé : le SVG éditorial légitime traverse intact.
{
  const src = '<svg viewBox="0 0 10 10" role="img"><line x1="0" y1="0" x2="9" y2="9" stroke="#1A237E" stroke-width="2" stroke-dasharray="none"/></svg>';
  const h = mdToHtml(src);
  attendre('sécu : SVG éditorial préservé', /<svg/.test(h) && /<line/.test(h) && /stroke-dasharray="none"/.test(h), h);
}
// Compatibilité KaTeX (R1) : la sortie MathML traverse l'assainissement.
{
  const h = mdToHtml('<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow></math>');
  attendre('sécu : MathML (KaTeX R1) préservé', /<math/.test(h) && /<mi>x<\/mi>/.test(h), h);
}

// ── 8. Maths & chimie : moteur scientifique (R1 — KaTeX → MathML) ────
{
  const h = mdToHtml('La relation $E=mc^2$ est célèbre.');
  attendre('maths : inline → <math> + <msup>, plus de $', /<math/.test(h) && /<msup>/.test(h) && !/\$/.test(h), h);
}
{
  // Display : les $$ doivent être sur leurs propres lignes (convention remark-math).
  const h = mdToHtml('$$\n\\int_0^1 x^2\\,dx\n$$');
  attendre('maths : display ($$ multi-lignes) → display="block"', /<math[^>]*display="block"/.test(h), h);
}
{
  const h = mdToHtml('$\\dfrac{a}{b}$');
  attendre('maths : fraction → <mfrac>', /<mfrac>/.test(h), h);
}
{
  const h = mdToHtml('$\\sqrt{x+1}$');
  attendre('maths : racine → <msqrt>', /<msqrt>/.test(h), h);
}
{
  const h = mdToHtml('$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$');
  attendre('maths : matrice → <mtable>', /<mtable[\s>]/.test(h), h);
}
{
  const h = mdToHtml('$$\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}$$');
  attendre('maths : système → <mtable>', /<mtable[\s>]/.test(h), h);
}
{
  const h = mdToHtml('$\\ce{2H2 + O2 -> 2H2O}$');
  attendre('chimie : mhchem \\ce{} → <math>', /<math/.test(h) && /<mn>2<\/mn>/.test(h), h);
}
// Interaction KaTeX + sanitize : maths rendues ET charge hostile neutralisée.
{
  const h = mdToHtml('Formule $a^2+b^2$ puis <script>alert(1)</script>.');
  attendre('maths+sécu : <math> présent ET <script> supprimé', /<math/.test(h) && !/<script/i.test(h), h);
}
// Aucun faux positif : un texte sans $ ne produit aucun <math>.
{
  const h = mdToHtml('Le prix est de 5000 FCFA, aucune formule ici.');
  attendre('maths : aucun faux positif (pas de <math> sans $)', !/<math/.test(h), h);
}
// Sortie MathML pure : aucune webfont/CSS KaTeX requise.
{
  const h = mdToHtml('$$\\frac{-b\\pm\\sqrt{\\Delta}}{2a}$$');
  attendre('maths : MathML pur (aucune classe katex-html)', /<math/.test(h) && !/katex-html/.test(h), h);
}

// ── 9. Rapport ───────────────────────────────────────────────────────
let echecs = 0;
for (const c of checks) {
  if (c.ok) {
    console.log(`  ✓ ${c.nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${c.nom}`);
    if (c.detail) console.log(`      obtenu: ${c.detail.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
console.log(`\n${checks.length - echecs}/${checks.length} vérifications OK`);
process.exit(echecs === 0 ? 0 : 1);
