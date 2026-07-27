// Garde-fou de rendu (sans framework) — vérifie que l'API publique `mdToHtml`
// produit le HTML attendu sur les traits Markdown/GFM/HTML brut réellement
// utilisés par les leçons. Filet anti-régression pour R0 puis R1+.
//
//   Lancement :  npx tsx scripts/render-check.ts    (ou  npm run render:check)
//   Sortie     :  code 0 si tout passe, code 1 sinon (utilisable en CI).
//
// Les cas de vérification vivent dans un FOYER UNIQUE (src/lib/render/
// render-cases.ts), partagé avec la suite vitest — pas de duplication.

import { mdToHtml } from '../src/lib/markdown';
import { CAS_RENDU } from '../src/lib/render/render-cases';

let echecs = 0;
for (const cas of CAS_RENDU) {
  const html = mdToHtml(cas.entree);
  const ok = cas.verifier(html);
  if (ok) {
    console.log(`  ✓ ${cas.nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${cas.nom}`);
    console.log(`      obtenu: ${html.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
console.log(`\n${CAS_RENDU.length - echecs}/${CAS_RENDU.length} vérifications OK`);
process.exit(echecs === 0 ? 0 : 1);
