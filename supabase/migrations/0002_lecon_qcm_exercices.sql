-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0002 : QCM et exercices intégrés aux leçons
-- ═══════════════════════════════════════════════════════════════════
-- Le QCM de leçon (« Évaluation des ressources ») est formatif :
-- correction instantanée côté client, donc les bonnes réponses font
-- partie de la leçon publique. Rien à voir avec la Salle de
-- Composition, dont les corrigés restent côté serveur.
--
-- qcm       : [{enonce_mdx, options: [texte], bonnes: [index], explication_mdx}]
-- exercices : [{titre, enonce_mdx, corrige_mdx}]

alter table lecons
  add column qcm jsonb,
  add column exercices jsonb;
