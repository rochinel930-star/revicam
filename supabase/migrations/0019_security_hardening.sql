-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0019 : durcissement sécurité (advisories Supabase)
-- ═══════════════════════════════════════════════════════════════════
-- Suite au linter de sécurité Supabase, après application de 0006→0018.
-- 100 % ADDITIVE, aucun changement de comportement fonctionnel.
--
-- 1) search_path explicite sur les fonctions trigger/utilitaires
--    (defense-in-depth contre l'injection de search_path). is_staff() le
--    fixait déjà.
-- 2) is_staff() ne doit pas être appelable directement en RPC par `anon` :
--    elle n'est destinée qu'aux policies RLS. On retire l'EXECUTE public
--    (qui incluait anon) et on ne l'accorde qu'à `authenticated` — requis
--    par les policies content_version / ingestion_* — et à service_role.
--
-- Les vues SECURITY DEFINER (lecons_public, questions_public, chapitre,
-- v_notion_chaine, feature_flags_public, lesson_artifact_public) sont
-- INTENTIONNELLES : elles n'exposent que des colonnes/lignes sûres et
-- doivent contourner la RLS des tables secrètes. Les convertir en
-- security_invoker casserait le modèle « accès public uniquement via vue ».
-- Elles ne sont donc pas modifiées ici (décision documentée, ADR 0003/0008).

-- ── 1) search_path explicite ─────────────────────────────────────────
alter function public.fn_content_version_immutable()       set search_path = public, pg_temp;
alter function public.fn_snapshot_lecon(uuid, jsonb)        set search_path = public, pg_temp;
alter function public.fn_restore_lecon_version(uuid)        set search_path = public, pg_temp;
alter function public.fn_default_chapitre_from_module()     set search_path = public, pg_temp;
alter function public.fn_default_programme_from_classe()    set search_path = public, pg_temp;

-- ── 2) EXECUTE de is_staff() restreint (retirer anon du RPC public) ───
revoke execute on function public.is_staff() from public;
grant  execute on function public.is_staff() to authenticated, service_role;

-- ── Rollback ─────────────────────────────────────────────────────────
-- grant execute on function public.is_staff() to public;
-- (les set search_path se retirent avec `reset search_path` par fonction)
