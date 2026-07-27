'use client';

// Questions ouvertes (P8). Question PRÉ-RENDUE côté serveur. La réponse de
// l'élève est corrigée par le modèle premium via /api/lecons/[id]/grade
// (le corrigé type reste secret côté serveur). Coût premium, à la soumission.

import { useState } from 'react';

export interface ItemOuverte {
  questionHtml: string;
  bareme: number;
}

interface Feedback {
  note?: number;
  bareme: number;
  appreciation?: string;
  points_forts?: string[];
  points_a_corriger?: string[];
  indisponible?: boolean;
  message?: string;
}

function Question({ item, index, leconId, signature }: { item: ItemOuverte; index: number; leconId: string; signature: string }) {
  const [reponse, setReponse] = useState('');
  const [etat, setEtat] = useState<'saisie' | 'correction' | 'corrige'>('saisie');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function corriger() {
    setEtat('correction');
    try {
      const res = await fetch(`/api/lecons/${leconId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, index, reponse }),
      });
      setFeedback(await res.json());
    } catch {
      setFeedback({ bareme: item.bareme, indisponible: true, message: 'Connexion impossible.' });
    }
    setEtat('corrige');
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: item.questionHtml }} />
      <p className="mt-1 text-xs text-slate-400">Barème : {item.bareme} pts</p>
      <textarea
        value={reponse}
        onChange={(e) => setReponse(e.target.value)}
        disabled={etat !== 'saisie'}
        rows={4}
        placeholder="Rédige ta réponse ici…"
        className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-navy focus:outline-none disabled:bg-slate-50"
      />
      {etat !== 'corrige' && (
        <button
          type="button"
          onClick={corriger}
          disabled={etat === 'correction' || reponse.trim().length === 0}
          className="mt-2 rounded-md bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {etat === 'correction' ? 'Correction…' : 'Corriger ma réponse'}
        </button>
      )}
      {feedback && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
          {feedback.indisponible ? (
            <p className="text-slate-600">{feedback.message}</p>
          ) : (
            <>
              <p className="font-bold text-navy">
                Note : {feedback.note} / {feedback.bareme}
              </p>
              {feedback.appreciation && <p className="mt-1 text-slate-700">{feedback.appreciation}</p>}
              {feedback.points_a_corriger && feedback.points_a_corriger.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-slate-600">
                  {feedback.points_a_corriger.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function QuestionsOuvertes({
  leconId,
  signature,
  items,
}: {
  leconId: string;
  signature: string;
  items: ItemOuverte[];
}) {
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <Question key={i} item={it} index={i} leconId={leconId} signature={signature} />
      ))}
    </div>
  );
}
