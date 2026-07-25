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

// ── 7. Rapport ───────────────────────────────────────────────────────
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
