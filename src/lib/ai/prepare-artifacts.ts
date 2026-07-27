// Préparation SERVEUR des artefacts pour le viewer — Phase P8.
// Rendu MDX → HTML au moment du rendu de page (render-at-write) : les
// composants clients ne reçoivent que du HTML + des données d'interaction.

import { mdToHtml } from '@/lib/markdown';
import type { ArtefactsParType } from './artifacts-repo';
import type { QcmItem, Flashcard, VraiFauxItem, QuestionOuverte, Explication } from '@/lib/types';
import type { CarteFlash } from '@/components/Flashcards';
import type { ItemVF } from '@/components/VraiFaux';
import type { ItemExplication } from '@/components/ExplainPanel';
import type { ItemOuverte } from '@/components/QuestionsOuvertes';

export interface OutilsIA {
  qcm: QcmItem[] | null;
  flashcards: CarteFlash[] | null;
  vraiFaux: ItemVF[] | null;
  explications: ItemExplication[] | null;
  questionsOuvertes: ItemOuverte[] | null;
  qoSignature: string | null;
}

export function preparerOutils(artefacts: ArtefactsParType): OutilsIA {
  const out: OutilsIA = {
    qcm: null,
    flashcards: null,
    vraiFaux: null,
    explications: null,
    questionsOuvertes: null,
    qoSignature: null,
  };

  if (artefacts.qcm) out.qcm = artefacts.qcm.payload as QcmItem[];

  if (artefacts.flashcards) {
    out.flashcards = (artefacts.flashcards.payload as Flashcard[]).map((c) => ({
      recto: c.recto,
      versoHtml: mdToHtml(c.verso_mdx),
    }));
  }

  if (artefacts.vrai_faux) {
    out.vraiFaux = (artefacts.vrai_faux.payload as VraiFauxItem[]).map((x) => ({
      affirmationHtml: mdToHtml(x.affirmation_mdx),
      correct: x.correct,
      explicationHtml: x.explication_mdx ? mdToHtml(x.explication_mdx) : null,
    }));
  }

  if (artefacts.explications) {
    out.explications = (artefacts.explications.payload as Explication[]).map((e) => ({
      titre: e.titre,
      corpsHtml: mdToHtml(e.corps_mdx),
    }));
  }

  if (artefacts.questions_ouvertes) {
    out.questionsOuvertes = (artefacts.questions_ouvertes.payload as QuestionOuverte[]).map((x) => ({
      questionHtml: mdToHtml(x.question_mdx),
      bareme: x.bareme,
    }));
    out.qoSignature = artefacts.questions_ouvertes.signature;
  }

  return out;
}

/** Vrai si au moins un outil IA est disponible pour la leçon. */
export function aDesOutils(o: OutilsIA): boolean {
  return Boolean(o.qcm || o.flashcards || o.vraiFaux || o.explications || o.questionsOuvertes);
}
