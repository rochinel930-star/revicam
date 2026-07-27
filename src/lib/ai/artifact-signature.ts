// Signature de cache d'un artefact de leçon — Phase P8.
//
// Clé de mutualisation et d'invalidation : hash(type + prompt_version +
// lesson_version). lesson_version = signature de contenu de la leçon (P7).
// Un changement de prompt OU de contenu → nouvelle signature → régénération.

import { fnv1a } from '@/lib/hash';

export function signatureArtefact(
  type: string,
  promptVersion: string,
  lessonVersion: string
): string {
  return fnv1a(`${type}:${promptVersion}:${lessonVersion}`);
}
