'use client';

// Petit badge d'état d'une leçon dans les listes (depuis le localStorage).

import { getProgress, type ProgressLecon } from '@/lib/local';
import { useMounted } from '@/lib/use-mounted';

export default function BadgeProgressLecon({ leconId }: { leconId: string }) {
  const mounted = useMounted();
  const p: ProgressLecon | null = mounted ? getProgress()[leconId] ?? null : null;
  if (!p) return null;
  if (p.statut === 'terminee')
    return <span className="text-xs font-medium text-green-700">✓ terminée{p.meilleur_score_qcm !== null ? ` · ${p.meilleur_score_qcm}/20` : ''}</span>;
  if (p.statut === 'qcm_fait')
    return <span className="text-xs font-medium text-orange-600">QCM fait{p.meilleur_score_qcm !== null ? ` · ${p.meilleur_score_qcm}/20` : ''}</span>;
  return <span className="text-xs text-slate-400">vue</span>;
}
