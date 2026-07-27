// Orchestrateur de génération d'artefacts de leçon — Phase P8.
//
// Génère TOUS les types via les générateurs, valide déterministiquement,
// calcule la signature de cache et le coût. À exécuter À L'ÉCRITURE (script),
// jamais au runtime élève. Sans adaptateur disponible : renvoie des erreurs
// par type (les étapes déterministes de validation restent utilisables).

import type { LessonContext } from '@/lib/lesson-context';
import type { TypeArtefactLecon } from '@/lib/types';
import { adapterActif, type LlmAdapter } from './adapter';
import { GENERATEURS, type Generateur } from './generators';
import { signatureArtefact } from './artifact-signature';
import { estimerCoutEur } from './cost';

export interface ArtefactGenere {
  lecon_id: string;
  type: TypeArtefactLecon;
  signature: string;
  lesson_version: string;
  prompt_version: string;
  payload: unknown;
  secret: unknown | null;
  provenance: Record<string, unknown>;
  cost_tokens: number;
  cost_eur: number;
  modele: string | null;
}

export interface ResultatGeneration {
  artefacts: ArtefactGenere[];
  erreurs: Array<{ type: TypeArtefactLecon; problemes: string[] }>;
  coutTotalEur: number;
}

export async function genererArtefactsLecon(
  ctx: LessonContext,
  adapter: LlmAdapter = adapterActif(),
  generateurs: Generateur[] = GENERATEURS
): Promise<ResultatGeneration> {
  const artefacts: ArtefactGenere[] = [];
  const erreurs: ResultatGeneration['erreurs'] = [];
  let coutTotalEur = 0;

  for (const g of generateurs) {
    if (!adapter.disponible() || !adapter.generer) {
      erreurs.push({ type: g.type, problemes: ['adaptateur_indisponible'] });
      continue;
    }
    let reponse;
    try {
      reponse = await adapter.generer(g.construirePrompt(ctx), ctx.texteBrut);
    } catch (e) {
      erreurs.push({ type: g.type, problemes: [`generation_echec:${(e as Error).message}`] });
      continue;
    }
    const validation = g.valider(reponse.contenu);
    if (!validation.ok) {
      erreurs.push({ type: g.type, problemes: validation.problemes });
      continue;
    }
    const tokens = reponse.cout_tokens ?? 0;
    const eur = estimerCoutEur(tokens, g.palier);
    coutTotalEur += eur;
    artefacts.push({
      lecon_id: ctx.leconId,
      type: g.type,
      signature: signatureArtefact(g.type, g.promptVersion, ctx.signature),
      lesson_version: ctx.signature,
      prompt_version: g.promptVersion,
      payload: validation.payload,
      secret: validation.secret ?? null,
      provenance: {
        adapter: adapter.nom,
        palier: g.palier,
        genere_le: new Date().toISOString(),
      },
      cost_tokens: tokens,
      cost_eur: eur,
      modele: reponse.modele ?? null,
    });
  }

  return { artefacts, erreurs, coutTotalEur };
}
