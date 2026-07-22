'use client';

// Stockage local : identifiant anonyme, progression de leçons, historique
// de compositions. Tout fonctionne sans compte.

export interface ProgressLecon {
  statut: 'vue' | 'qcm_fait' | 'terminee';
  meilleur_score_qcm: number | null;
  updated_at: string;
}

export interface HistoriqueAttempt {
  attempt_id: string;
  composition_id: string;
  composition_titre: string;
  note_finale: number | null;
  bareme_total: number;
  date: string;
}

const KEY_ANON = 'revicam.anon_id';
const KEY_PROGRESS = 'revicam.progress';
const KEY_HISTORIQUE = 'revicam.attempts';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* stockage plein ou bloqué : on continue sans persistance */
  }
}

/** UUID anonyme, généré au premier passage, stable ensuite. */
export function getAnonId(): string {
  let id = safeGet(KEY_ANON);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(KEY_ANON, id);
  }
  return id;
}

export function getProgress(): Record<string, ProgressLecon> {
  const raw = safeGet(KEY_PROGRESS);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setProgressLecon(leconId: string, patch: Partial<ProgressLecon>): void {
  const all = getProgress();
  const prev = all[leconId];
  const next: ProgressLecon = {
    statut: patch.statut ?? prev?.statut ?? 'vue',
    meilleur_score_qcm:
      patch.meilleur_score_qcm !== undefined && patch.meilleur_score_qcm !== null
        ? Math.max(patch.meilleur_score_qcm, prev?.meilleur_score_qcm ?? 0)
        : prev?.meilleur_score_qcm ?? null,
    updated_at: new Date().toISOString(),
  };
  // Ne jamais rétrograder le statut (terminee > qcm_fait > vue).
  const rang = { vue: 0, qcm_fait: 1, terminee: 2 } as const;
  if (prev && rang[prev.statut] > rang[next.statut]) next.statut = prev.statut;
  all[leconId] = next;
  safeSet(KEY_PROGRESS, JSON.stringify(all));
}

export function getHistorique(): HistoriqueAttempt[] {
  const raw = safeGet(KEY_HISTORIQUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function pushHistorique(entry: HistoriqueAttempt): void {
  const all = getHistorique().filter((h) => h.attempt_id !== entry.attempt_id);
  all.unshift(entry);
  safeSet(KEY_HISTORIQUE, JSON.stringify(all.slice(0, 50)));
}

/** Brouillon de composition en cours (réponses), pour survivre aux coupures. */
export function saveBrouillon(attemptId: string, reponses: unknown): void {
  safeSet(`revicam.brouillon.${attemptId}`, JSON.stringify(reponses));
}

export function getBrouillon<T>(attemptId: string): T | null {
  const raw = safeGet(`revicam.brouillon.${attemptId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearBrouillon(attemptId: string): void {
  try {
    window.localStorage.removeItem(`revicam.brouillon.${attemptId}`);
  } catch {
    /* ignorer */
  }
}

/** Tentative en cours pour une composition (pour reprendre après coupure). */
export function getAttemptEnCours(compositionId: string): string | null {
  return safeGet(`revicam.encours.${compositionId}`);
}

export function setAttemptEnCours(compositionId: string, attemptId: string | null): void {
  try {
    if (attemptId) window.localStorage.setItem(`revicam.encours.${compositionId}`, attemptId);
    else window.localStorage.removeItem(`revicam.encours.${compositionId}`);
  } catch {
    /* ignorer */
  }
}
