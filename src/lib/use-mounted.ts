import { useSyncExternalStore } from 'react';

// L'état « monté » ne change qu'une fois (au montage) : pas de réabonnement.
const subscribe = () => () => {};

/**
 * useMounted — solution OFFICIELLE de RéviCam pour détecter l'état « monté »
 * côté client (après hydratation).
 *
 * Besoin d'architecture React 19 qu'il résout : lire une donnée **client-only**
 * (localStorage, `window`, date locale…) sans provoquer
 *   1. de mismatch d'hydratation — SSR **et** premier rendu client renvoient
 *      `false`, donc le HTML serveur et le premier HTML client sont identiques ;
 *   2. de `setState` dans un effet — évite la règle React 19
 *      `react-hooks/set-state-in-effect` et le double rendu associé.
 *
 * Patron d'usage (unique dans tout le projet) :
 *
 *   const mounted = useMounted();
 *   const valeur = mounted ? lireDonneeClientOnly() : valeurParDefaut;
 *
 * Implémentation : `useSyncExternalStore` avec des snapshots **primitifs stables**
 * — `getServerSnapshot` renvoie `false` (SSR + hydratation), `getSnapshot` renvoie
 * `true` (client) — ce qui évite tout avertissement de cache de snapshot.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
