'use client';

// File de revue d'ingestion — Phase P4.
//
// Réservée au staff : la RLS (migration 0017) ne renvoie les jobs qu'aux
// utilisateurs staff. Un visiteur non-staff voit une file vide. Le staff peut
// marquer chaque job accepté/rejeté (la promotion vers le contenu reste une
// opération serveur privilégiée, hors de ce navigateur).

import { useEffect, useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { sbBrowser } from '@/lib/supabase-browser';

interface JobRevue {
  id: string;
  statut: string;
  job: { id: string; source: string; type: string; statut: string; content_hash: string } | null;
}

export default function PageRevue() {
  const [jobs, setJobs] = useState<JobRevue[]>([]);
  const [chargement, setChargement] = useState(true);

  // Lecture seule (aucun setState) : appelée après await, jamais en synchrone
  // dans un effet (règle React 19 set-state-in-effect).
  const lireJobs = useCallback(async (): Promise<JobRevue[]> => {
    const { data } = await sbBrowser()
      .from('ingestion_review')
      .select('id, statut, job:ingestion_job(id, source, type, statut, content_hash)')
      .order('id');
    return (data as unknown as JobRevue[]) ?? [];
  }, []);

  useEffect(() => {
    let annule = false;
    lireJobs().then((d) => {
      if (!annule) {
        setJobs(d);
        setChargement(false);
      }
    });
    return () => {
      annule = true;
    };
  }, [lireJobs]);

  async function decider(id: string, statut: 'accepte' | 'rejete') {
    await sbBrowser()
      .from('ingestion_review')
      .update({ statut, decided_at: new Date().toISOString() })
      .eq('id', id);
    setChargement(true);
    setJobs(await lireJobs());
    setChargement(false);
  }

  return (
    <div className="pt-4">
      <h1 className="mb-1 text-2xl font-bold text-navy">🗃️ Revue d’ingestion</h1>
      <p className="mb-4 text-sm text-slate-600">
        File réservée au staff. La promotion vers le contenu se fait après acceptation, via une
        opération serveur (jamais de publication automatique).
      </p>

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : jobs.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          Aucun job en revue (ou session non-staff).
        </Card>
      ) : (
        <ul className="space-y-3">
          {jobs.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{r.job?.source ?? '—'}</p>
                    <p className="text-xs text-slate-500">
                      {r.job?.type} · job {r.job?.statut} · empreinte {r.job?.content_hash}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.statut === 'accepte'
                        ? 'bg-svteehb-bg text-svteehb'
                        : r.statut === 'rejete'
                          ? 'bg-physique-bg text-physique'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.statut}
                  </span>
                </div>
                {r.statut === 'en_attente' && (
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => decider(r.id, 'accepte')}>Accepter</Button>
                    <Button variante="secondaire" onClick={() => decider(r.id, 'rejete')}>
                      Rejeter
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
