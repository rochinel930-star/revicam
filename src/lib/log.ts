// Observabilité — Phase P1 (durcissement de la plateforme).
//
// Log structuré (JSON une ligne) corrélé par `request_id`. Server-only.
// Objectif : des traces exploitables (Vercel/agrégateur) sans dépendance
// externe. Aucune donnée personnelle ne doit transiter ici (cf. principes
// de confidentialité) — n'y mettre que des identifiants techniques.

export type Niveau = 'info' | 'warn' | 'error';

export interface Journal {
  requestId: string;
  info: (message: string, champs?: Record<string, unknown>) => void;
  warn: (message: string, champs?: Record<string, unknown>) => void;
  error: (message: string, champs?: Record<string, unknown>) => void;
}

/** Génère un identifiant de requête (corrélation des traces). */
export function nouveauRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Repli si l'API Web Crypto est indisponible dans le runtime.
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function emettre(
  niveau: Niveau,
  requestId: string,
  message: string,
  champs?: Record<string, unknown>
): void {
  const ligne = {
    ts: new Date().toISOString(),
    niveau,
    request_id: requestId,
    message,
    ...(champs ?? {}),
  };
  const texte = JSON.stringify(ligne);
  if (niveau === 'error') console.error(texte);
  else if (niveau === 'warn') console.warn(texte);
  else console.log(texte);
}

/**
 * logger — crée un journal corrélé. Fournir un `requestId` existant
 * (propagation) ou en générer un nouveau par défaut.
 */
export function logger(requestId: string = nouveauRequestId()): Journal {
  return {
    requestId,
    info: (m, c) => emettre('info', requestId, m, c),
    warn: (m, c) => emettre('warn', requestId, m, c),
    error: (m, c) => emettre('error', requestId, m, c),
  };
}
