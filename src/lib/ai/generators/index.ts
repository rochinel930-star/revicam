// Registre des générateurs d'artefacts de leçon — Phase P8.

import { qcmGenerateur } from './qcm';
import { flashcardsGenerateur } from './flashcards';
import { vraiFauxGenerateur } from './vrai-faux';
import { questionsOuvertesGenerateur } from './questions-ouvertes';
import { explicationsGenerateur } from './explications';
import type { Generateur } from './types';

export const GENERATEURS: Generateur[] = [
  qcmGenerateur,
  flashcardsGenerateur,
  vraiFauxGenerateur,
  questionsOuvertesGenerateur,
  explicationsGenerateur,
];

export type { Generateur, ResultatValidationArtefact } from './types';
