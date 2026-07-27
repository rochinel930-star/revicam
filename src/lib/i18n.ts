// Internationalisation bilingue fr/en — Phase P5.
//
// Le Cameroun est bilingue : chaque libellé d'interface dispose d'une
// variante anglaise. Dictionnaire minimal, typé (les clés manquantes sont
// des erreurs de compilation), extensible au fil des phases consommatrices.

export type Lang = 'fr' | 'en';

export const LANGS: Lang[] = ['fr', 'en'];

const DICT = {
  'offline.title': { fr: 'Tu es hors connexion', en: 'You are offline' },
  'offline.body': {
    fr: 'Cette page n’est pas encore disponible hors ligne. Reconnecte-toi pour continuer à réviser.',
    en: 'This page is not available offline yet. Reconnect to keep revising.',
  },
  'offline.retry': { fr: 'Réessayer', en: 'Retry' },
  'offline.home': { fr: 'Accueil', en: 'Home' },
} as const;

export type MessageKey = keyof typeof DICT;

/** Traduit une clé dans la langue donnée (repli fr). */
export function t(key: MessageKey, lang: Lang = 'fr'): string {
  const entry = DICT[key];
  return entry[lang] ?? entry.fr;
}
