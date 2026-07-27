// Étape 8 — persistance en STAGING (jamais en prod). Phase P4.
//
// Le pipeline n'écrit QUE dans les tables ingestion_* (isolées). La promotion
// vers le contenu est une étape humaine séparée. Idempotent par empreinte
// (ré-ingestion = 0 doublon).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artefact, ExtractionEpreuve, ResultatIngestion } from './types';

export interface EntreeJob {
  source: string;
  type: string;
  statut: string;
  content_hash: string;
}

export interface PersisteurStaging {
  jobExistant(hash: string): Promise<boolean>;
  creerJob(input: EntreeJob): Promise<string>;
  creerArtefact(jobId: string, mime: string, texte: string): Promise<void>;
  creerExtraction(jobId: string, payload: ExtractionEpreuve, score: number, suggestions: string[]): Promise<void>;
  creerRevue(jobId: string): Promise<void>;
}

export interface ResultatPersistance {
  jobId: string | null;
  doublon: boolean;
}

/** Persiste un résultat d'ingestion en staging (idempotent). */
export async function persister(
  result: ResultatIngestion,
  artefact: Artefact,
  texteSource: string,
  persisteur: PersisteurStaging
): Promise<ResultatPersistance> {
  if (await persisteur.jobExistant(result.hash)) {
    return { jobId: null, doublon: true };
  }
  const jobId = await persisteur.creerJob({
    source: artefact.source,
    type: artefact.type,
    statut: result.ok ? 'valide' : 'invalide',
    content_hash: result.hash,
  });
  await persisteur.creerArtefact(jobId, artefact.mime, texteSource);
  if (result.extraction) {
    await persisteur.creerExtraction(jobId, result.extraction, result.score, result.suggestions);
  }
  await persisteur.creerRevue(jobId);
  return { jobId, doublon: false };
}

/** Implémentation Supabase (service_role) du persisteur de staging. */
export function creerPersisteurSupabase(client: SupabaseClient): PersisteurStaging {
  return {
    async jobExistant(hash) {
      const { data } = await client
        .from('ingestion_job')
        .select('id')
        .eq('content_hash', hash)
        .maybeSingle();
      return Boolean(data);
    },
    async creerJob(input) {
      const { data, error } = await client.from('ingestion_job').insert(input).select('id').single();
      if (error || !data) throw new Error(`creerJob: ${error?.message}`);
      return data.id as string;
    },
    async creerArtefact(jobId, mime, texte) {
      const { error } = await client
        .from('ingestion_artifact')
        .insert({ job_id: jobId, mime, texte, bytes: texte.length });
      if (error) throw new Error(`creerArtefact: ${error.message}`);
    },
    async creerExtraction(jobId, payload, score, suggestions) {
      const { error } = await client
        .from('ingestion_extraction')
        .insert({ job_id: jobId, payload, score, suggestions });
      if (error) throw new Error(`creerExtraction: ${error.message}`);
    },
    async creerRevue(jobId) {
      const { error } = await client
        .from('ingestion_review')
        .insert({ job_id: jobId, statut: 'en_attente' });
      if (error) throw new Error(`creerRevue: ${error.message}`);
    },
  };
}
