'use client';

// Barre de progression d'une matière, calculée depuis le localStorage
// (leçons au statut qcm_fait ou terminee parmi les leçons publiées).

import { useEffect, useState } from 'react';
import { getProgress } from '@/lib/local';

export default function ProgressionMatiere({
  leconIds,
  couleur,
}: {
  leconIds: string[];
  couleur: string;
}) {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    if (leconIds.length === 0) {
      setPct(null);
      return;
    }
    const progress = getProgress();
    const faites = leconIds.filter((id) => {
      const p = progress[id];
      return p && (p.statut === 'qcm_fait' || p.statut === 'terminee');
    }).length;
    setPct(Math.round((faites / leconIds.length) * 100));
  }, [leconIds]);

  if (pct === null) return null;
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: couleur }} />
      </div>
      <p className="mt-1 text-[0.7rem] text-slate-500">{pct}% des leçons travaillées</p>
    </div>
  );
}
