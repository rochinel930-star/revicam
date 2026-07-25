-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0004 : fermeture de l'accès direct anon aux
-- leçons non publiées (Phase 0, sécurité). Fait suite à 0003.
-- ═══════════════════════════════════════════════════════════════════
-- Avant : policy "lecture publique" SELECT using(true) → n'importe qui
--         pouvait lire le CONTENU des leçons non publiées (réponses de
--         QCM, corrigés) directement via /rest/v1/lecons.
-- Après : la lecture directe anon/authenticated de la table de base est
--         limitée aux leçons publiées. Le frontend ne lit plus la table
--         de base : il passe par la vue `lecons_public` (migration 0003,
--         SECURITY DEFINER, owner=postgres) qui expose les métadonnées de
--         toutes les leçons mais masque le contenu tant que publie=false.
--         Le service_role (routes API, import) bypasse la RLS et conserve
--         son accès complet.
--
-- Prouvé avant application : aucune lecture anon de la table de base ne
-- subsiste dans le code (seules getLecon/getLeconsDesModules lisaient
-- `lecons` ; elles lisent désormais `lecons_public`). attempts-server.ts
-- et scripts/import/writer.ts lisent `lecons` via service_role.
--
-- Non destructif : aucune donnée modifiée, aucun changement de schéma.
-- Réversible : voir la commande de rollback en bas.

alter policy "lecture publique" on public.lecons using (publie = true);

-- ── Rollback (si besoin) ────────────────────────────────────────────
-- alter policy "lecture publique" on public.lecons using (true);
