'use client';

// Mon espace : progression des leçons + historique des compositions,
// à partir du localStorage (aucun compte requis).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProgress, getHistorique, type ProgressLecon, type HistoriqueAttempt } from '@/lib/local';
import { couleurNote } from '@/lib/config';

export default function MonEspaceClient() {
  const [progress, setProgress] = useState<Record<string, ProgressLecon> | null>(null);
  const [historique, setHistorique] = useState<HistoriqueAttempt[]>([]);

  useEffect(() => {
    setProgress(getProgress());
    setHistorique(getHistorique());
  }, []);

  if (progress === null) {
    return <p className="p-6 text-center text-sm text-slate-500">Chargement…</p>;
  }

  const lecons = Object.values(progress);
  const terminees = lecons.filter((p) => p.statut === 'terminee').length;
  const qcmFaits = lecons.filter((p) => p.statut !== 'vue').length;

  return (
    <div className="space-y-6">
      {/* ── Progression ── */}
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="font-bold text-navy">📘 Ma progression de cours</h2>
        {lecons.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Tu n’as pas encore commencé.{' '}
            <Link href="/cours" className="font-semibold text-navy underline">Ouvre ta première leçon →</Link>
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-slate-50 p-3">
              <dd className="text-2xl font-bold text-navy">{lecons.length}</dd>
              <dt className="text-[0.7rem] text-slate-500">leçons vues</dt>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dd className="text-2xl font-bold text-orange-600">{qcmFaits}</dd>
              <dt className="text-[0.7rem] text-slate-500">QCM faits</dt>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dd className="text-2xl font-bold text-green-700">{terminees}</dd>
              <dt className="text-[0.7rem] text-slate-500">terminées (≥ 10/20)</dt>
            </div>
          </dl>
        )}
      </section>

      {/* ── Historique des compositions ── */}
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="font-bold text-navy">✍️ Mes compositions</h2>
        {historique.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucune composition pour l’instant.{' '}
            <Link href="/composition" className="font-semibold text-navy underline">Entre en salle →</Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {historique.map((h) => {
              const note20 = h.note_finale !== null ? (h.note_finale * 20) / h.bareme_total : null;
              return (
                <li key={h.attempt_id}>
                  <Link
                    href={`/composition/${h.composition_id}/resultat?attempt=${h.attempt_id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-navy"
                  >
                    <span>
                      <span className="block font-medium text-slate-800">{h.composition_titre}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </span>
                    {note20 !== null ? (
                      <span className="text-lg font-bold tabular-nums" style={{ color: couleurNote(note20) }}>
                        {Number.isInteger(note20) ? note20 : note20.toFixed(1)}/20
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-orange-500">correction en attente</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">
        💡 La création de compte (pour retrouver ta progression sur plusieurs appareils) arrive bientôt.
      </p>
    </div>
  );
}
