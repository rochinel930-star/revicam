'use client';

// Écran de résultats : note /20, détail par question, diagnostic par leçon,
// partage WhatsApp. Charge le résultat via l'API (l'anon_id prouve la
// propriété de la tentative).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnonId } from '@/lib/local';
import ScoreCircle from './ScoreCircle';
import ShareWhatsApp from './ShareWhatsApp';
import type { ResultatPayload } from '@/lib/attempts-server';

export default function ResultatClient({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<ResultatPayload | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    async function charger() {
      try {
        const res = await fetch(`/api/attempts/${attemptId}?anon_id=${getAnonId()}`);
        if (!res.ok) throw new Error(String(res.status));
        const payload = await res.json();
        if (!annule) {
          if (!payload.questions) setErreur('Cette tentative n’est pas encore soumise.');
          else setData(payload);
        }
      } catch {
        if (!annule) setErreur('Résultat introuvable. (Le résultat n’est visible que sur l’appareil qui a composé.)');
      }
    }
    charger();
    return () => { annule = true; };
  }, [attemptId]);

  if (erreur) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-slate-600">{erreur}</p>
        <Link href="/composition" className="mt-3 inline-block text-sm font-semibold text-navy underline">
          ← Retour à la Salle de Composition
        </Link>
      </div>
    );
  }
  if (!data) {
    return <p className="p-6 text-center text-sm text-slate-500">Chargement du résultat…</p>;
  }

  const { attempt, composition, questions, diagnostic } = data;
  const sousTotal = questions.reduce((s, q) => s + (q.note ?? 0), 0);
  const note20 = attempt.note_finale !== null
    ? (attempt.note_finale * 20) / composition.bareme_total
    : null;
  const faibles = diagnostic.filter((d) => d.bareme > 0 && d.points / d.bareme < 0.5);

  return (
    <div className="space-y-6">
      {/* ── Note globale ── */}
      <section className="rounded-lg bg-white p-5 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">{composition.titre}</h1>
        {note20 !== null ? (
          <>
            <div className="mt-3"><ScoreCircle note20={note20} /></div>
            <p className="mt-2 text-sm text-slate-600">
              {note20 < 10
                ? 'En dessous de 10 — au Probatoire, chaque matière doit être ≥ 10/20. Le diagnostic ci-dessous te dit exactement quoi réviser.'
                : note20 <= 12
                  ? 'Au-dessus de la barre des 10, mais reste vigilant(e) : consolide les leçons du diagnostic.'
                  : 'Très bon niveau ! Continue à t’entraîner pour rester au-dessus de la barre.'}
            </p>
            <div className="mt-4"><ShareWhatsApp note20={note20} titre={composition.titre} /></div>
          </>
        ) : (
          <div className="mt-3 rounded-md bg-orange-50 p-4 text-sm text-orange-800">
            <p className="font-semibold">Correction IA indisponible pour le moment.</p>
            <p className="mt-1">
              Tes QCM sont notés ({sousTotal} pt{sousTotal > 1 ? 's' : ''} acquis) — tes réponses rédigées
              sont bien enregistrées, repasse plus tard pour la correction complète.
            </p>
          </div>
        )}
      </section>

      {/* ── Diagnostic par leçon ── */}
      {diagnostic.length > 0 && (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="font-bold text-navy">🎯 Ton diagnostic</h2>
          <ul className="mt-3 space-y-2">
            {diagnostic.map((d) => {
              const faible = d.bareme > 0 && d.points / d.bareme < 0.5;
              return (
                <li key={d.lecon_id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${faible ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                  <span>
                    <span className="font-medium">Leçon {d.numero} — {d.titre}</span>
                    <span className={`ml-2 font-semibold ${faible ? 'text-red-700' : 'text-green-700'}`}>
                      {d.points}/{d.bareme}
                    </span>
                  </span>
                  {faible && (
                    <Link href={d.url} className="text-xs font-bold text-navy underline">
                      👉 Réviser cette leçon
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {faibles.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">Aucun point faible détecté sur cette épreuve. 👏</p>
          )}
        </section>
      )}

      {/* ── Détail par question ── */}
      <section>
        <h2 className="mb-2 font-bold text-navy">📝 Ta copie corrigée</h2>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const choix = q.reponse && 'choix' in q.reponse ? q.reponse.choix : null;
            const texte = q.reponse && 'texte' in q.reponse ? q.reponse.texte : null;
            const enAttente = q.type === 'libre' && q.note === null;
            return (
              <article key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
                  <span className="font-semibold">Question {i + 1}</span>
                  <span className={`font-bold ${enAttente ? 'text-orange-500' : (q.note ?? 0) >= q.bareme ? 'text-green-700' : (q.note ?? 0) > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                    {enAttente ? 'en attente' : `${q.note ?? 0} / ${q.bareme}`}
                  </span>
                </p>
                <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: q.enonce_html }} />

                {q.type === 'qcm' && q.options && (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {q.options.map((opt) => {
                      const bonne = q.bonnes_reponses?.includes(opt.id) ?? false;
                      const cochee = choix?.includes(opt.id) ?? false;
                      return (
                        <li
                          key={opt.id}
                          className={`rounded-md border px-3 py-1.5 ${
                            bonne ? 'border-green-600 bg-green-50 text-green-800'
                              : cochee ? 'border-red-400 bg-red-50 text-red-700'
                                : 'border-slate-200 text-slate-500'
                          }`}
                        >
                          {bonne ? '✓ ' : cochee ? '✗ ' : ''}{opt.texte}
                          {cochee && <span className="ml-1 text-xs">(ta réponse)</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {q.type === 'libre' && (
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Ta réponse :</p>
                      <p className="whitespace-pre-wrap">{texte?.trim() || '(pas de réponse)'}</p>
                    </div>
                    {q.feedback_ia && (
                      <div className="rounded-md border border-maths bg-maths-bg p-3">
                        <p className="text-sm">{q.feedback_ia.appreciation}</p>
                        {q.feedback_ia.points_forts.length > 0 && (
                          <p className="mt-1.5 text-xs text-green-700">
                            ✓ {q.feedback_ia.points_forts.join(' · ')}
                          </p>
                        )}
                        {q.feedback_ia.points_a_corriger.length > 0 && (
                          <p className="mt-1 text-xs text-red-700">
                            ✗ {q.feedback_ia.points_a_corriger.join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                    {q.corrige_html && (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-navy">Voir le corrigé type</summary>
                        <div className="prose mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" dangerouslySetInnerHTML={{ __html: q.corrige_html }} />
                      </details>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="pb-4 text-center">
        <Link href="/composition" className="text-sm font-semibold text-navy underline">
          ← Composer une autre épreuve
        </Link>
      </div>
    </div>
  );
}
