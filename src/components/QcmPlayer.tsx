'use client';

// « Évaluation des ressources » : QCM de leçon avec correction instantanée
// question par question, score final /20, bouton Recommencer.
// Les bonnes réponses de ce QCM formatif font partie de la leçon (pédagogie
// immédiate) — rien à voir avec la Salle de Composition, corrigée côté serveur.

import { useEffect, useMemo, useState } from 'react';
import type { QcmItem } from '@/lib/types';
import { setProgressLecon } from '@/lib/local';

interface Props {
  leconId: string;
  items: QcmItem[];
}

type Etat = { choisis: number[]; validee: boolean };

export default function QcmPlayer({ leconId, items }: Props) {
  const [etats, setEtats] = useState<Etat[]>(() => items.map(() => ({ choisis: [], validee: false })));
  const [cle, setCle] = useState(0); // pour Recommencer

  const nbValidees = etats.filter((e) => e.validee).length;
  const nbJustes = useMemo(
    () =>
      etats.filter((e, i) => {
        if (!e.validee) return false;
        const bonnes = items[i].bonnes;
        return e.choisis.length === bonnes.length && e.choisis.every((c) => bonnes.includes(c));
      }).length,
    [etats, items]
  );
  const fini = nbValidees === items.length;
  const score20 = items.length > 0 ? Math.round((nbJustes / items.length) * 20 * 10) / 10 : 0;

  function toggle(qi: number, oi: number) {
    setEtats((prev) => {
      const e = prev[qi];
      if (e.validee) return prev;
      const multi = items[qi].bonnes.length > 1;
      const next = [...prev];
      if (multi) {
        next[qi] = {
          ...e,
          choisis: e.choisis.includes(oi) ? e.choisis.filter((c) => c !== oi) : [...e.choisis, oi],
        };
      } else {
        // Choix unique : sélectionner = valider immédiatement.
        next[qi] = { choisis: [oi], validee: true };
      }
      return next;
    });
  }

  function valider(qi: number) {
    setEtats((prev) => {
      if (prev[qi].choisis.length === 0) return prev;
      const next = [...prev];
      next[qi] = { ...next[qi], validee: true };
      return next;
    });
  }

  function recommencer() {
    setEtats(items.map(() => ({ choisis: [], validee: false })));
    setCle((k) => k + 1);
  }

  // Enregistrer la progression quand tout est validé.
  useEffect(() => {
    if (fini) {
      setProgressLecon(leconId, {
        statut: score20 >= 10 ? 'terminee' : 'qcm_fait',
        meilleur_score_qcm: score20,
      });
    }
  }, [fini, leconId, score20]);

  return (
    <div key={cle} className="space-y-5">
      {items.map((q, qi) => {
        const e = etats[qi];
        const multi = q.bonnes.length > 1;
        const juste =
          e.validee && e.choisis.length === q.bonnes.length && e.choisis.every((c) => q.bonnes.includes(c));
        return (
          <div key={qi} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-3 font-medium">
              <span className="mr-1 text-slate-400">{qi + 1}.</span>
              {q.enonce_mdx}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const choisi = e.choisis.includes(oi);
                let style = 'border-slate-300 bg-white hover:border-navy';
                if (e.validee) {
                  if (q.bonnes.includes(oi)) style = 'border-green-600 bg-green-50 text-green-800';
                  else if (choisi) style = 'border-red-500 bg-red-50 text-red-700';
                  else style = 'border-slate-200 text-slate-400';
                } else if (choisi) {
                  style = 'border-navy bg-maths-bg';
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={e.validee}
                    onClick={() => toggle(qi, oi)}
                    className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition ${style}`}
                  >
                    {multi && (
                      <span aria-hidden className="mr-2">{choisi ? '☑' : '☐'}</span>
                    )}
                    {opt}
                    {e.validee && q.bonnes.includes(oi) && <span aria-hidden className="ml-2">✓</span>}
                    {e.validee && choisi && !q.bonnes.includes(oi) && <span aria-hidden className="ml-2">✗</span>}
                  </button>
                );
              })}
            </div>
            {multi && !e.validee && (
              <button
                type="button"
                onClick={() => valider(qi)}
                className="mt-3 rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                disabled={e.choisis.length === 0}
              >
                Valider
              </button>
            )}
            {e.validee && (
              <p className={`mt-3 rounded-md px-3 py-2 text-sm ${juste ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {juste ? 'Bonne réponse !' : 'Ce n’est pas ça.'}
                {q.explication_mdx ? ` ${q.explication_mdx}` : ''}
              </p>
            )}
          </div>
        );
      })}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
        {fini ? (
          <>
            <p className="text-lg font-bold" style={{ color: score20 < 10 ? '#DC2626' : score20 <= 12 ? '#EA580C' : '#16A34A' }}>
              Ton score : {score20} / 20
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {score20 >= 10
                ? 'Au-dessus de 10 — c’est la barre exigée dans TOUTES les matières au Probatoire. Continue !'
                : 'En dessous de 10 : relis le cours ci-dessus puis retente ta chance.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {nbValidees} / {items.length} questions répondues
          </p>
        )}
        <button
          type="button"
          onClick={recommencer}
          className="mt-3 rounded-md border border-navy px-4 py-1.5 text-sm font-medium text-navy hover:bg-maths-bg"
        >
          Recommencer
        </button>
      </div>
    </div>
  );
}
