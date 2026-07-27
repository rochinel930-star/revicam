// Persistance des artefacts (service_role) — Phase P8.
// Upsert sur (lecon_id, type, signature) : mutualisation + idempotence.
// Une régénération identique n'écrit pas de doublon.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArtefactGenere } from './generate-artifacts';

export interface PersisteurArtefacts {
  upsert(a: ArtefactGenere): Promise<void>;
}

export function creerPersisteurArtefacts(client: SupabaseClient): PersisteurArtefacts {
  return {
    async upsert(a) {
      const { error } = await client.from('lesson_artifact').upsert(
        {
          lecon_id: a.lecon_id,
          type: a.type,
          signature: a.signature,
          lesson_version: a.lesson_version,
          prompt_version: a.prompt_version,
          payload: a.payload,
          secret: a.secret,
          provenance: a.provenance,
          cost_tokens: a.cost_tokens,
          cost_eur: a.cost_eur,
          modele: a.modele,
        },
        { onConflict: 'lecon_id,type,signature' }
      );
      if (error) throw new Error(`upsert artefact ${a.type} : ${error.message}`);
    },
  };
}
