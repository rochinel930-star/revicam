'use client';

// Authentification & identité — Phase P6.
//
// Modèle : ANONYME PAR DÉFAUT (anon_id local), compte OPTIONNEL (lien magique
// e-mail, sans mot de passe → rien à saisir de sensible). À la connexion, la
// progression locale est FUSIONNÉE dans le compte (jamais de perte, jamais de
// rétrogradation de statut). Non bloquant : l'app fonctionne sans compte.

import { sbBrowser } from './supabase-browser';
import { getProgress, type ProgressLecon } from './local';
import { SITE_URL } from './config';

const RANG = { vue: 0, qcm_fait: 1, terminee: 2 } as const;

export interface LeconProgressExistant {
  lecon_id: string;
  statut: ProgressLecon['statut'];
  meilleur_score_qcm: number | null;
}
export interface LeconProgressRow {
  lecon_id: string;
  user_id: string;
  statut: ProgressLecon['statut'];
  meilleur_score_qcm: number | null;
}

/**
 * planifierFusion — pur : compare la progression locale à celle déjà en
 * compte et calcule les lignes à INSÉRER (nouvelles) et à METTRE À JOUR
 * (local plus avancé). Ne rétrograde jamais un statut ni un score.
 */
export function planifierFusion(
  local: Record<string, ProgressLecon>,
  existant: LeconProgressExistant[],
  userId: string
): { inserts: LeconProgressRow[]; updates: LeconProgressRow[] } {
  const parId = new Map(existant.map((e) => [e.lecon_id, e]));
  const inserts: LeconProgressRow[] = [];
  const updates: LeconProgressRow[] = [];
  for (const [lecon_id, p] of Object.entries(local)) {
    const ex = parId.get(lecon_id);
    const ligne: LeconProgressRow = {
      lecon_id,
      user_id: userId,
      statut: p.statut,
      meilleur_score_qcm: p.meilleur_score_qcm,
    };
    if (!ex) {
      inserts.push(ligne);
    } else {
      const statutPlusHaut = RANG[p.statut] > RANG[ex.statut];
      const scorePlusHaut = (p.meilleur_score_qcm ?? 0) > (ex.meilleur_score_qcm ?? 0);
      if (statutPlusHaut || scorePlusHaut) {
        updates.push({
          ...ligne,
          statut: statutPlusHaut ? p.statut : ex.statut,
          meilleur_score_qcm: Math.max(p.meilleur_score_qcm ?? 0, ex.meilleur_score_qcm ?? 0) || null,
        });
      }
    }
  }
  return { inserts, updates };
}

/** Envoie un lien magique de connexion (aucun mot de passe à saisir). */
export async function envoyerLienConnexion(email: string): Promise<void> {
  const { error } = await sbBrowser().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/mon-espace` },
  });
  if (error) throw error;
}

export async function seDeconnecter(): Promise<void> {
  await sbBrowser().auth.signOut();
}

export async function utilisateurCourant() {
  const { data } = await sbBrowser().auth.getUser();
  return data.user;
}

/**
 * migrerProgressionLocale — fusionne la progression locale dans le compte.
 * Idempotent, best-effort (n'interrompt jamais l'expérience).
 * @returns nombre de leçons synchronisées.
 */
export async function migrerProgressionLocale(userId: string): Promise<number> {
  const local = getProgress();
  const leconIds = Object.keys(local);
  if (leconIds.length === 0) return 0;

  const sb = sbBrowser();
  const { data: existant } = await sb
    .from('lecon_progress')
    .select('lecon_id, statut, meilleur_score_qcm')
    .eq('user_id', userId)
    .in('lecon_id', leconIds);

  const { inserts, updates } = planifierFusion(local, (existant as LeconProgressExistant[]) ?? [], userId);

  if (inserts.length > 0) {
    await sb.from('lecon_progress').insert(inserts);
  }
  for (const u of updates) {
    await sb
      .from('lecon_progress')
      .update({ statut: u.statut, meilleur_score_qcm: u.meilleur_score_qcm })
      .eq('user_id', userId)
      .eq('lecon_id', u.lecon_id);
  }
  return inserts.length + updates.length;
}
