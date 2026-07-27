// Carte de capacité Gemini + routage multi-modèles — 100 % Gemini.
//
// ÉTABLIE PAR PREUVES (sonde ListModels + generateContent JSON, 2026-07-27).
// Objectif : coût minimal. Chaînes ordonnées ; le premier modèle qui répond
// gagne, avec repli automatique sur quota (429) ou modèle retiré (404).
//
// Politique :
//   - ÉCO : tâches « intelligentes » bon marché (génération QCM/flashcards/
//     vrai-faux/questions ouvertes/explications, grounding) → modèle le moins cher.
//   - CORRECTION : notation de réponses libres → modèle minimal MAIS capable
//     (un cran au-dessus), toujours économique.
//
// Mémoire des modèles ÉCARTÉS (ne pas réessayer) et de leur cause.

/** Génération & tâches bon marché — du moins cher au repli. */
export const CHAINE_ECO = [
  'gemini-flash-lite-latest', // ~1.4s, JSON ok, alias stable le moins cher
  'gemini-3.1-flash-lite',    // ~1.2s, très rapide
  'gemini-flash-latest',      // repli robuste
];

/** Correction (minimal capable) — raisonnement fiable, coût maîtrisé. */
export const CHAINE_CORRECTION = [
  'gemini-flash-latest',      // ~2.3s, correction fiable
  'gemini-flash-lite-latest', // repli économique
];

/**
 * Modèles écartés et cause vérifiée (mémoire de routage : évite de les
 * réessayer, réactivables si Google change les quotas/disponibilités).
 */
export const MODELES_ECARTES: Record<string, string> = {
  'gemini-2.0-flash': 'quota free tier = 0 (429)',
  'gemini-2.0-flash-001': 'quota free tier = 0 (429)',
  'gemini-2.0-flash-lite': 'quota free tier = 0 (429)',
  'gemini-2.0-flash-lite-001': 'quota free tier = 0 (429)',
  'gemini-pro-latest': 'quota free tier = 0 (429)',
  'gemini-2.5-pro': 'quota free tier = 0 (429)',
  'gemini-2.5-flash': 'retiré — no longer available to new users (404)',
  'gemini-2.5-flash-lite': 'retiré (404)',
  'gemini-1.5-flash': 'retiré (404)',
  'gemma-4-26b-a4b-it': 'ne respecte pas le mode JSON (sortie texte)',
  'gemma-4-31b-it': 'ne respecte pas le mode JSON (sortie texte)',
};
