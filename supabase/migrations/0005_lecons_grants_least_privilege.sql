-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0005 : moindre privilège sur lecons (Phase 0)
-- ═══════════════════════════════════════════════════════════════════
-- Suite de 0003 (vue) + 0004 (RLS publie=true). 0004 bloque déjà la
-- lecture des brouillons. 0005 applique le CONTRAT STRICT : le frontend
-- (anon / authenticated) ne doit accéder aux leçons QUE via la vue
-- `lecons_public`, jamais directement à la table de base.
--
-- Avant : anon/authenticated ont SELECT (+ INSERT/UPDATE/DELETE inertes,
--         bloqués par la RLS mais présents) directement sur public.lecons,
--         et le jeu complet de droits sur la vue.
-- Après : anon/authenticated n'ont plus AUCUN droit direct sur la table
--         de base ; sur la vue, uniquement SELECT.
--
-- Sûreté prouvée avant application :
--   - frontend : getLecon + getLeconsDesModules lisent lecons_public ;
--   - la vue est SECURITY DEFINER (owner=postgres) → elle lit la table de
--     base en tant que propriétaire, donc retirer les droits anon sur la
--     base ne casse PAS la vue ;
--   - diagnostic (attempts-server) + import (writer) lisent public.lecons
--     via service_role, dont les droits ne sont PAS touchés ici.
--
-- Non destructif (aucune donnée, aucun schéma modifié). 0004 reste en
-- défense en profondeur. Réversible : voir rollback en bas.

revoke all privileges on table public.lecons        from anon, authenticated;
revoke all privileges on table public.lecons_public from anon, authenticated;
grant  select          on table public.lecons_public to   anon, authenticated;

-- ── Rollback (si besoin) ────────────────────────────────────────────
-- grant select on table public.lecons to anon, authenticated;
-- grant select on table public.lecons_public to anon, authenticated;
