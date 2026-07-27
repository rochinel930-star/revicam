// Garde des routes d'administration — Phase P4.
//
// Les routes /api/admin/* exigent un jeton serveur (ADMIN_API_TOKEN). Si le
// jeton n'est pas configuré, l'administration est DÉSACTIVÉE (503) : rien de
// sensible n'est exposé par défaut. Comparaison à temps constant.

function egaliteConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type VerdictAdmin = { ok: true } | { ok: false; statut: 401 | 503; raison: string };

export function verifierAdmin(req: Request): VerdictAdmin {
  const attendu = process.env.ADMIN_API_TOKEN;
  if (!attendu) return { ok: false, statut: 503, raison: 'Administration désactivée (ADMIN_API_TOKEN absent)' };
  const brut =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.headers.get('x-admin-token') ?? '';
  if (!brut || !egaliteConstante(brut, attendu)) {
    return { ok: false, statut: 401, raison: 'Jeton d’administration invalide' };
  }
  return { ok: true };
}
