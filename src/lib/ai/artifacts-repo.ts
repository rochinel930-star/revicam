// Repository de lecture des artefacts (cache) — Phase P8.
//
// Runtime élève = LECTURE du cache public (0 appel IA). Ne lit que la vue
// `lesson_artifact_public` (jamais la partie `secret`). On filtre sur la
// version courante de la leçon (lesson_version = signature P7) : si le contenu
// a changé sans régénération, aucun artefact périmé n'est servi.

import { sbPublic } from '@/lib/supabase';
import type { LessonArtifactPublic, TypeArtefactLecon } from '@/lib/types';

export type ArtefactsParType = Partial<Record<TypeArtefactLecon, LessonArtifactPublic>>;

/** Artefacts courants d'une leçon, indexés par type (version courante). */
export async function getArtefactsCourants(
  leconId: string,
  lessonVersion: string
): Promise<ArtefactsParType> {
  const parType: ArtefactsParType = {};
  try {
    const { data, error } = await sbPublic()
      .from('lesson_artifact_public')
      .select('*')
      .eq('lecon_id', leconId)
      .eq('lesson_version', lessonVersion);
    // Résilient : si la vue n'existe pas encore (migration non appliquée) ou
    // toute autre erreur transitoire, on ne montre simplement aucun outil —
    // jamais de plantage de la leçon (zéro régression).
    if (error) return parType;
    for (const a of (data as LessonArtifactPublic[]) ?? []) {
      parType[a.type] = a;
    }
  } catch {
    /* aucun outil disponible */
  }
  return parType;
}
