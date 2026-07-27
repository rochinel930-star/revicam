// Foyer unique des cas de vérification du moteur de rendu.
//
// Consommé par DEUX exécuteurs (pas de duplication — cf. principe
// « config, pas duplication ») :
//   - scripts/render-check.ts   → garde-fou sans framework (npm run render:check)
//   - tests/render.spec.ts      → suite vitest (npm test)
//   - tests/security/injection.spec.ts → sous-ensemble tag === 'securite'
//
// Chaque cas fournit une entrée Markdown et un prédicat sur le HTML rendu
// par `mdToHtml`. Le champ `tag` classe le cas (base | securite | maths).

export type TagCas = 'base' | 'securite' | 'maths';

export interface CasRendu {
  nom: string;
  entree: string | null | undefined;
  verifier: (html: string) => boolean;
  tag: TagCas;
}

function compte(h: string, re: RegExp): number {
  return (h.match(re) || []).length;
}

export const CAS_RENDU: CasRendu[] = [
  // ── 1. Cas vides : contrat de signature ────────────────────────────
  { nom: 'null → chaîne vide', entree: null, verifier: (h) => h === '', tag: 'base' },
  { nom: 'undefined → chaîne vide', entree: undefined, verifier: (h) => h === '', tag: 'base' },
  { nom: 'vide → chaîne vide', entree: '', verifier: (h) => h === '', tag: 'base' },

  // ── 2. Markdown de base ────────────────────────────────────────────
  { nom: 'titre h1', entree: '# Titre\n\nUn **gras** et de l’*italique*.', verifier: (h) => /<h1>Titre<\/h1>/.test(h), tag: 'base' },
  { nom: 'gras', entree: '# Titre\n\nUn **gras** et de l’*italique*.', verifier: (h) => /<strong>gras<\/strong>/.test(h), tag: 'base' },
  { nom: 'italique', entree: '# Titre\n\nUn **gras** et de l’*italique*.', verifier: (h) => /<em>italique<\/em>/.test(h), tag: 'base' },

  // ── 3. Listes ──────────────────────────────────────────────────────
  { nom: 'liste : 3 <li>', entree: '- un\n- deux\n- trois', verifier: (h) => compte(h, /<li>/g) === 3, tag: 'base' },
  { nom: 'liste : <ul>', entree: '- un\n- deux\n- trois', verifier: (h) => /<ul>/.test(h), tag: 'base' },

  // ── 4. Tableau GFM ─────────────────────────────────────────────────
  { nom: 'tableau : <table>', entree: '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |', verifier: (h) => /<table>/.test(h), tag: 'base' },
  { nom: 'tableau : <thead>', entree: '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |', verifier: (h) => /<thead>/.test(h), tag: 'base' },
  { nom: 'tableau : 3 lignes <tr>', entree: '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |', verifier: (h) => compte(h, /<tr>/g) === 3, tag: 'base' },

  // ── 5. Encadrés pédagogiques ───────────────────────────────────────
  { nom: 'encadré : div.box.box-formule', entree: ':::formule Travail\nW = F × d\n:::', verifier: (h) => /<div class="box box-formule">/.test(h), tag: 'base' },
  { nom: 'encadré : titre explicite', entree: ':::formule Travail\nW = F × d\n:::', verifier: (h) => /<p class="box-title">Travail<\/p>/.test(h), tag: 'base' },
  { nom: 'encadré : label par défaut', entree: ':::definition\nÉnergie du mouvement.\n:::', verifier: (h) => /<p class="box-title">Définition<\/p>/.test(h), tag: 'base' },
  { nom: 'encadré : box-exemple', entree: ':::exemple\nUn cas.\n:::', verifier: (h) => /<div class="box box-exemple">/.test(h), tag: 'base' },

  // ── 6. SVG inline (HTML brut préservé) ─────────────────────────────
  { nom: 'svg : balise préservée', entree: '<svg viewBox="0 0 10 10" role="img"><line x1="0" y1="0" x2="9" y2="9" stroke="#000"/></svg>', verifier: (h) => /<svg[\s>]/.test(h), tag: 'base' },
  { nom: 'svg : enfant <line> préservé', entree: '<svg viewBox="0 0 10 10" role="img"><line x1="0" y1="0" x2="9" y2="9" stroke="#000"/></svg>', verifier: (h) => /<line[\s>]/.test(h), tag: 'base' },

  // ── 7. Sécurité : assainissement R2 (défense en profondeur) ────────
  { nom: 'sécu : <script> et son contenu supprimés', entree: 'Bonjour <script>alert(1)</script> fin.', verifier: (h) => !/<script/i.test(h) && !/alert\(1\)/.test(h), tag: 'securite' },
  { nom: 'sécu : gestionnaire onerror supprimé', entree: '<img src=x onerror="alert(1)">', verifier: (h) => !/onerror/i.test(h), tag: 'securite' },
  { nom: 'sécu : protocole javascript: supprimé', entree: '[clique](javascript:alert(1))', verifier: (h) => !/javascript:/i.test(h), tag: 'securite' },
  { nom: 'sécu : SVG malveillant neutralisé (onload retiré, svg conservé)', entree: '<svg onload="alert(1)"><line x1="0" y1="0" x2="9" y2="9" stroke="red"/></svg>', verifier: (h) => !/onload/i.test(h) && /<svg/.test(h) && /<line/.test(h), tag: 'securite' },
  { nom: 'sécu : foreignObject + iframe supprimés', entree: '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>', verifier: (h) => !/foreignObject/i.test(h) && !/<iframe/i.test(h), tag: 'securite' },
  { nom: 'sécu : style inline supprimé', entree: '<div style="background:url(javascript:alert(1))">x</div>', verifier: (h) => !/style=/i.test(h), tag: 'securite' },
  { nom: 'sécu : object/embed supprimés', entree: '<object data="x"></object><embed src="y">', verifier: (h) => !/<object|<embed/i.test(h), tag: 'securite' },
  { nom: 'sécu : SVG éditorial préservé', entree: '<svg viewBox="0 0 10 10" role="img"><line x1="0" y1="0" x2="9" y2="9" stroke="#1A237E" stroke-width="2" stroke-dasharray="none"/></svg>', verifier: (h) => /<svg/.test(h) && /<line/.test(h) && /stroke-dasharray="none"/.test(h), tag: 'securite' },
  { nom: 'sécu : MathML (KaTeX R1) préservé', entree: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow></math>', verifier: (h) => /<math/.test(h) && /<mi>x<\/mi>/.test(h), tag: 'securite' },

  // ── 8. Maths & chimie (R1 — KaTeX → MathML) ────────────────────────
  { nom: 'maths : inline → <math> + <msup>, plus de $', entree: 'La relation $E=mc^2$ est célèbre.', verifier: (h) => /<math/.test(h) && /<msup>/.test(h) && !/\$/.test(h), tag: 'maths' },
  { nom: 'maths : display ($$ multi-lignes) → display="block"', entree: '$$\n\\int_0^1 x^2\\,dx\n$$', verifier: (h) => /<math[^>]*display="block"/.test(h), tag: 'maths' },
  { nom: 'maths : fraction → <mfrac>', entree: '$\\dfrac{a}{b}$', verifier: (h) => /<mfrac>/.test(h), tag: 'maths' },
  { nom: 'maths : racine → <msqrt>', entree: '$\\sqrt{x+1}$', verifier: (h) => /<msqrt>/.test(h), tag: 'maths' },
  { nom: 'maths : matrice → <mtable>', entree: '$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$', verifier: (h) => /<mtable[\s>]/.test(h), tag: 'maths' },
  { nom: 'maths : système → <mtable>', entree: '$$\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}$$', verifier: (h) => /<mtable[\s>]/.test(h), tag: 'maths' },
  { nom: 'chimie : mhchem \\ce{} → <math>', entree: '$\\ce{2H2 + O2 -> 2H2O}$', verifier: (h) => /<math/.test(h) && /<mn>2<\/mn>/.test(h), tag: 'maths' },
  { nom: 'maths+sécu : <math> présent ET <script> supprimé', entree: 'Formule $a^2+b^2$ puis <script>alert(1)</script>.', verifier: (h) => /<math/.test(h) && !/<script/i.test(h), tag: 'maths' },
  { nom: 'maths : aucun faux positif (pas de <math> sans $)', entree: 'Le prix est de 5000 FCFA, aucune formule ici.', verifier: (h) => !/<math/.test(h), tag: 'maths' },
  { nom: 'maths : MathML pur (aucune classe katex-html)', entree: '$$\\frac{-b\\pm\\sqrt{\\Delta}}{2a}$$', verifier: (h) => /<math/.test(h) && !/katex-html/.test(h), tag: 'maths' },
];
