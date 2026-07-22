'use client';

// Écran de composition (Pilier 3).
// - Chrono sticky (orange à 25 % restant, rouge à 10 %), auto-remise à 0.
// - Palette de navigation numérotée (répondu / non répondu).
// - Sauvegarde automatique : localStorage à chaque frappe + serveur toutes
//   les 10 s — une coupure ne fait rien perdre.
// - Aucune bonne réponse n'est présente dans ce composant : la correction
//   est exclusivement côté serveur, après remise de la copie.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAnonId, getAttemptEnCours, setAttemptEnCours,
  saveBrouillon, getBrouillon, clearBrouillon, pushHistorique,
} from '@/lib/local';
import type { Reponse } from '@/lib/types';

export interface QuestionSession {
  id: string;
  ordre: number;
  type: 'qcm' | 'libre';
  enonceHtml: string;
  options: { id: string; texte: string }[] | null;
  bareme: number;
}

interface Props {
  composition: {
    id: string;
    titre: string;
    duree_minutes: number;
    mode_affichage: 'une_par_une' | 'liste';
    bareme_total: number;
  };
  questions: QuestionSession[];
}

function estRepondue(r: Reponse | undefined): boolean {
  if (!r) return false;
  if ('choix' in r) return r.choix.length > 0;
  return r.texte.trim().length > 0;
}

export default function SessionClient({ composition, questions }: Props) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [restant, setRestant] = useState<number | null>(null);
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [courante, setCourante] = useState(0);
  const [remise, setRemise] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dirty = useRef(false);
  const reponsesRef = useRef(reponses);
  reponsesRef.current = reponses;

  // ── Initialisation : tentative + chrono + brouillon ───────────────
  useEffect(() => {
    let annule = false;
    async function init() {
      let id = getAttemptEnCours(composition.id);
      let startedAt: string | null = id
        ? window.localStorage.getItem(`revicam.start.${id}`)
        : null;
      if (!id) {
        try {
          const res = await fetch('/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ composition_id: composition.id, anon_id: getAnonId() }),
          });
          if (res.ok) {
            const data = await res.json();
            id = data.attempt_id as string;
            startedAt = data.started_at as string;
            setAttemptEnCours(composition.id, id);
            window.localStorage.setItem(`revicam.start.${id}`, startedAt);
          }
        } catch { /* hors ligne : on continue en local */ }
      }
      if (annule) return;
      if (!id) {
        setErreur('Impossible de démarrer la composition. Vérifie ta connexion puis recharge la page.');
        return;
      }
      if (!startedAt) {
        startedAt = new Date().toISOString();
        window.localStorage.setItem(`revicam.start.${id}`, startedAt);
      }
      setAttemptId(id);
      setDeadline(new Date(startedAt).getTime() + composition.duree_minutes * 60_000);
      const brouillon = getBrouillon<Record<string, Reponse>>(id);
      if (brouillon) setReponses(brouillon);
    }
    init();
    return () => { annule = true; };
  }, [composition.id, composition.duree_minutes]);

  // ── Chrono ────────────────────────────────────────────────────────
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setRestant(Math.max(0, deadline - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  // ── Sauvegarde serveur toutes les 10 s ────────────────────────────
  const sauvegarderServeur = useCallback(async () => {
    if (!attemptId || !dirty.current) return;
    dirty.current = false;
    try {
      await fetch(`/api/attempts/${attemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon_id: getAnonId(), reponses: reponsesRef.current }),
      });
    } catch {
      dirty.current = true; // réessayer au prochain cycle
    }
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(sauvegarderServeur, 10_000);
    return () => clearInterval(t);
  }, [sauvegarderServeur]);

  function changerReponse(qid: string, r: Reponse) {
    setReponses((prev) => {
      const next = { ...prev, [qid]: r };
      if (attemptId) saveBrouillon(attemptId, next);
      dirty.current = true;
      return next;
    });
  }

  // ── Remise de copie ───────────────────────────────────────────────
  const remettre = useCallback(async (auto = false) => {
    if (!attemptId || remise) return;
    if (!auto) {
      const sansReponse = questions.filter((q) => !estRepondue(reponsesRef.current[q.id])).length;
      const message = sansReponse > 0
        ? `Tu as ${sansReponse} question${sansReponse > 1 ? 's' : ''} sans réponse. Remettre quand même ?`
        : 'Remettre ta copie maintenant ?';
      if (!window.confirm(message)) return;
    }
    setRemise(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon_id: getAnonId(), reponses: reponsesRef.current }),
      });
      if (!res.ok) throw new Error('soumission refusée');
      const resultat = await res.json();
      clearBrouillon(attemptId);
      setAttemptEnCours(composition.id, null);
      pushHistorique({
        attempt_id: attemptId,
        composition_id: composition.id,
        composition_titre: composition.titre,
        note_finale: resultat.attempt?.note_finale ?? null,
        bareme_total: composition.bareme_total,
        date: new Date().toISOString(),
      });
      router.push(`/composition/${composition.id}/resultat?attempt=${attemptId}`);
    } catch {
      setRemise(false);
      setErreur('La remise a échoué (connexion ?). Tes réponses sont sauvegardées : réessaie.');
    }
  }, [attemptId, remise, questions, composition, router]);

  // Auto-remise quand le chrono atteint zéro.
  useEffect(() => {
    if (restant === 0 && attemptId && !remise) remettre(true);
  }, [restant, attemptId, remise, remettre]);

  // ── Rendu ─────────────────────────────────────────────────────────
  const total = composition.duree_minutes * 60_000;
  const ratio = restant !== null ? restant / total : 1;
  const couleurChrono = ratio <= 0.1 ? 'bg-red-600' : ratio <= 0.25 ? 'bg-orange-500' : 'bg-navy';
  const minutes = restant !== null ? Math.floor(restant / 60_000) : composition.duree_minutes;
  const secondes = restant !== null ? Math.floor((restant % 60_000) / 1000) : 0;

  const unParUn = composition.mode_affichage === 'une_par_une';
  const visibles = unParUn ? [questions[courante]] : questions;

  function allerA(i: number) {
    setCourante(i);
    if (!unParUn) {
      document.getElementById(`question-${questions[i].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div>
      {/* Chrono sticky */}
      <div className={`sticky top-12 z-30 -mx-3 flex items-center justify-between px-4 py-2 text-white ${couleurChrono}`}>
        <span className="truncate pr-2 text-sm font-medium">{composition.titre}</span>
        <span className="font-mono text-lg font-bold tabular-nums" aria-live="polite">
          ⏱ {String(minutes).padStart(2, '0')}:{String(secondes).padStart(2, '0')}
        </span>
      </div>

      {/* Palette de navigation */}
      <nav aria-label="Navigation des questions" className="mt-3 flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const ok = estRepondue(reponses[q.id]);
          const active = unParUn && i === courante;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => allerA(i)}
              aria-label={`Question ${i + 1}${ok ? ', répondue' : ', sans réponse'}`}
              className={`h-8 w-8 rounded-md border text-sm font-semibold transition ${
                active
                  ? 'border-navy bg-navy text-white'
                  : ok
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      {/* Questions */}
      <div className="mt-4 space-y-5">
        {visibles.map((q) => {
          const i = questions.findIndex((x) => x.id === q.id);
          const r = reponses[q.id];
          return (
            <article key={q.id} id={`question-${q.id}`} className="scroll-mt-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
                <span className="font-semibold">Question {i + 1} / {questions.length}</span>
                <span>{q.bareme} pt{q.bareme > 1 ? 's' : ''}</span>
              </p>
              <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: q.enonceHtml }} />

              {q.type === 'qcm' && q.options ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-400">Coche la ou les bonnes réponses.</p>
                  {q.options.map((opt) => {
                    const choisis = r && 'choix' in r ? r.choix : [];
                    const actif = choisis.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          changerReponse(q.id, {
                            choix: actif ? choisis.filter((c) => c !== opt.id) : [...choisis, opt.id],
                          })
                        }
                        className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          actif ? 'border-navy bg-maths-bg font-medium' : 'border-slate-300 bg-white hover:border-navy'
                        }`}
                      >
                        <span aria-hidden className="mr-2">{actif ? '☑' : '☐'}</span>
                        {opt.texte}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={r && 'texte' in r ? r.texte : ''}
                  onChange={(e) => changerReponse(q.id, { texte: e.target.value })}
                  rows={6}
                  placeholder="Rédige ta réponse ici, comme sur ta copie : démarche, calculs, conclusion…"
                  className="mt-3 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-navy focus:outline-none"
                />
              )}
            </article>
          );
        })}
      </div>

      {/* Navigation une-par-une */}
      {unParUn && (
        <div className="mt-4 flex justify-between text-sm">
          <button
            type="button"
            disabled={courante === 0}
            onClick={() => setCourante((c) => c - 1)}
            className="rounded-md border border-slate-300 px-4 py-2 disabled:opacity-40"
          >
            ← Précédente
          </button>
          <button
            type="button"
            disabled={courante === questions.length - 1}
            onClick={() => setCourante((c) => c + 1)}
            className="rounded-md border border-slate-300 px-4 py-2 disabled:opacity-40"
          >
            Suivante →
          </button>
        </div>
      )}

      {/* Remise */}
      <div className="mt-6 border-t border-slate-200 pt-4 text-center">
        {erreur && <p className="mb-2 text-sm text-red-600">{erreur}</p>}
        <button
          type="button"
          onClick={() => remettre(false)}
          disabled={remise || !attemptId}
          className="w-full rounded-lg bg-navy px-6 py-3 text-base font-bold text-white shadow hover:bg-navy-mid disabled:opacity-60 sm:w-auto"
        >
          {remise ? 'Correction en cours…' : '📤 Remettre ma copie'}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Sauvegarde automatique activée — tes réponses sont à l’abri.
        </p>
      </div>
    </div>
  );
}
