// Feature flags — Phase P1 (durcissement de la plateforme).
//
// FOYER UNIQUE des défauts : le tableau FLAG_DEFAULTS ci-dessous fait
// autorité. Un flag n'existe que s'il y figure (clés typées).
//
// Résolution d'un flag (ordre de priorité décroissant) :
//   1. Surcharge d'environnement  `FLAG_<CLÉ_MAJ>`  ("1"/"true"/"on" → true)
//   2. Surcharge en base          (table feature_flags, via getFlagRemote)
//   3. Valeur par défaut du code  (FLAG_DEFAULTS)
//
// `getFlag` est SYNCHRONE et server-only (lit process.env) : il ne fait
// jamais d'appel réseau, donc il est déterministe et testable. La couche
// base (getFlagRemote) est asynchrone et optionnelle ; elle retombe
// toujours sur getFlag en cas d'absence de surcharge ou d'erreur.
//
// ⚠️ Ne jamais importer ce module dans un composant client : il lit des
// variables d'environnement serveur.

import { sbPublic } from '@/lib/supabase';

// ── Registre des flags (défauts) ─────────────────────────────────────
export const FLAG_DEFAULTS = {
  // Flag pilote P1 : rend la réponse de /api/health verbeuse (détail des
  // checks). Par défaut activé — bascule un comportement observable.
  health_verbose: true,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

// ── Résolution env (synchrone) ───────────────────────────────────────
function lireEnv(key: FlagKey): boolean | undefined {
  const brut = process.env[`FLAG_${key.toUpperCase()}`];
  if (brut === undefined) return undefined;
  const v = brut.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return undefined;
}

/**
 * getFlag — résolution synchrone (env > défaut). Server-only.
 * Ne fait aucun appel réseau : sûr à utiliser dans le chemin chaud.
 */
export function getFlag(key: FlagKey): boolean {
  const env = lireEnv(key);
  if (env !== undefined) return env;
  return FLAG_DEFAULTS[key];
}

/**
 * getFlagRemote — résolution avec surcharge en base (env > table > défaut).
 * Asynchrone. Toute erreur (réseau, RLS, colonne) retombe silencieusement
 * sur getFlag : un flag ne doit jamais faire tomber une requête.
 */
export async function getFlagRemote(key: FlagKey): Promise<boolean> {
  const env = lireEnv(key);
  if (env !== undefined) return env;
  try {
    const { data, error } = await sbPublic()
      .from('feature_flags_public')
      .select('enabled')
      .eq('key', key)
      .maybeSingle();
    if (!error && data && typeof data.enabled === 'boolean') return data.enabled;
  } catch {
    /* repli défaut ci-dessous */
  }
  return FLAG_DEFAULTS[key];
}
