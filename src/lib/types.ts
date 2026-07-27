// Types des données publiques (miroir du schéma Supabase).

// ── Référentiel Données V2 (Phase P2) ───────────────────────────────
// Ajouts additifs : les entités du référentiel configurable 6e→Terminale
// et multi-pays. Les colonnes de rattachement sur les entités existantes
// (programme_id, niveau_id, serie_id, chapitre_id…) sont optionnelles pour
// préserver la rétro-compatibilité avec les lignes/inserts antérieurs.

export interface Pays {
  id: string;
  code: string;
  nom: string;
}

export interface Programme {
  id: string;
  pays_id: string;
  code: string;
  nom: string;
  config: Record<string, unknown>;
}

export interface Niveau {
  id: string;
  programme_id: string;
  code: string;
  nom: string;
  cycle: string | null;
  ordre: number;
}

export interface Serie {
  id: string;
  programme_id: string;
  code: string;
  nom: string;
}

export interface Sequence {
  id: string;
  programme_id: string;
  numero: number;
  nom: string;
}

/** Vue canonique `chapitre` (foyer physique : table `modules`). */
export interface Chapitre {
  id: string;
  programme_id: string | null;
  classe_id: string;
  matiere_id: string;
  sequence_id: string | null;
  numero: number;
  titre: string;
}

// ── Graphe de connaissances (Phase P3) ──────────────────────────────
export interface Notion {
  id: string;
  programme_id: string;
  chapitre_id: string;
  code: string;
  nom: string;
}

export interface Competence {
  id: string;
  programme_id: string;
  code: string;
  nom: string;
  domaine: string | null;
}

export interface ObjectifApc {
  id: string;
  programme_id: string;
  competence_id: string | null;
  code: string;
  enonce: string;
}

/** Ligne de la vue de traversée notion → … → pays. */
export interface ChaineNotion {
  notion_id: string;
  notion_code: string;
  notion_nom: string;
  chapitre_id: string;
  chapitre_titre: string;
  classe_id: string;
  classe_slug: string;
  programme_id: string;
  programme_code: string;
  pays_id: string;
  pays_code: string;
}

// ── Outils IA par leçon (Phase P8) ──────────────────────────────────
export type TypeArtefactLecon =
  | 'qcm'
  | 'flashcards'
  | 'vrai_faux'
  | 'questions_ouvertes'
  | 'explications';

export interface Flashcard {
  recto: string;
  verso_mdx: string;
}

export interface VraiFauxItem {
  affirmation_mdx: string;
  correct: boolean;
  explication_mdx: string | null;
}

/** Partie PUBLIQUE d'une question ouverte (la rubrique reste secrète). */
export interface QuestionOuverte {
  question_mdx: string;
  bareme: number;
}

export interface Explication {
  titre: string;
  corps_mdx: string;
}

/** Rubrique SECRÈTE de correction d'une question ouverte (server-only). */
export interface RubriqueOuverte {
  corrige_type_mdx: string;
  bareme: number;
}

/** Artefact tel que servi à l'élève (vue lesson_artifact_public, sans secret). */
export interface LessonArtifactPublic {
  id: string;
  lecon_id: string;
  type: TypeArtefactLecon;
  signature: string;
  lesson_version: string;
  payload: unknown; // typé selon `type` par les consommateurs
}

export type StatutVersion = 'brouillon' | 'publie' | 'archive';

export interface ContentVersion {
  id: string;
  entity_type: 'lecon';
  entity_id: string;
  version: number;
  content_hash: string;
  parent_version_id: string | null;
  statut: StatutVersion;
  snapshot: Record<string, unknown>;
  provenance: Record<string, unknown>;
  created_at: string;
}

export interface Classe {
  id: string;
  slug: string;
  nom: string;
  ordre: number;
  // Rattachement V2 (nullable tant que non backfillé).
  programme_id?: string | null;
  niveau_id?: string | null;
  serie_id?: string | null;
}

export interface Matiere {
  id: string;
  slug: string;
  nom: string;
  couleur_hex: string;
  icone: string | null;
}

export interface Module {
  id: string;
  matiere_id: string;
  classe_id: string;
  numero: number;
  titre: string;
  // Rattachement V2 (nullable tant que non backfillé).
  programme_id?: string | null;
  sequence_id?: string | null;
}

export interface QcmItem {
  enonce_mdx: string;
  options: string[];
  bonnes: number[];
  explication_mdx: string | null;
}

export interface Exercice {
  titre: string;
  enonce_mdx: string;
  corrige_mdx: string | null;
}

export interface Lecon {
  id: string;
  module_id: string;
  numero: number;
  titre: string;
  slug: string;
  duree_lecture_min: number | null;
  objectifs: string[];
  contenu_mdx: string | null;
  essentiel_mdx: string | null;
  jeu_bilingue: { fr: string; en: string }[] | null;
  qcm: QcmItem[] | null;
  exercices: Exercice[] | null;
  publie: boolean;
}

export type TypeEpreuve =
  | 'sequentielle'
  | 'composition'
  | 'blanc'
  | 'officiel'
  | 'controle'
  | 'bepc'
  | 'probatoire'
  | 'baccalaureat'
  | 'cep';

export interface Epreuve {
  id: string;
  classe_id: string;
  matiere_id: string;
  type: TypeEpreuve;
  numero_sequence: number | null;
  annee: number;
  serie: string | null;
  etablissement: string | null;
  titre: string;
  pdf_url: string | null;
  composable: boolean;
  // Rattachement V2 (nullable).
  programme_id?: string | null;
  serie_id?: string | null;
  session?: string | null;
}

export interface Composition {
  id: string;
  slug: string;
  titre: string;
  matiere_id: string;
  classe_id: string;
  source_epreuve_id: string | null;
  duree_minutes: number;
  bareme_total: number;
  mode_affichage: 'une_par_une' | 'liste';
  publie: boolean;
  // Rattachement V2 (nullable).
  programme_id?: string | null;
  serie_id?: string | null;
}

/** Question telle que vue par le client : vue questions_public, SANS corrigés. */
export interface QuestionPublique {
  id: string;
  composition_id: string;
  lecon_id: string | null;
  ordre: number;
  type: 'qcm' | 'libre';
  enonce_mdx: string;
  options: { id: string; texte: string }[] | null;
  bareme: number;
}

/** Réponse d'élève : ids d'options pour un qcm, texte pour une libre. */
export type Reponse = { choix: string[] } | { texte: string };

export interface FeedbackIA {
  appreciation: string;
  points_forts: string[];
  points_a_corriger: string[];
}

export interface AttemptAnswerResultat {
  question_id: string;
  reponse: Reponse | null;
  note: number | null;
  feedback_ia: FeedbackIA | null;
}

export interface Attempt {
  id: string;
  composition_id: string;
  statut: 'en_cours' | 'soumise' | 'corrigee' | 'correction_partielle';
  started_at: string;
  submitted_at: string | null;
  note_finale: number | null;
}

export const TYPE_EPREUVE_LABELS: Record<TypeEpreuve, string> = {
  sequentielle: 'Épreuve séquentielle',
  composition: 'Composition trimestrielle',
  blanc: 'Examen blanc',
  officiel: 'Sujet officiel',
  controle: 'Contrôle',
  bepc: 'BEPC',
  probatoire: 'Probatoire',
  baccalaureat: 'Baccalauréat',
  cep: 'CEP',
};
