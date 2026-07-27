-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0020 : is_staff() non appelable par anon (RPC)
-- ═══════════════════════════════════════════════════════════════════
-- Complète 0019. Supabase accorde EXECUTE directement au rôle `anon`
-- (pas seulement via PUBLIC) ; le `revoke ... from public` de 0019 ne
-- l'avait donc pas retiré. On révoque explicitement pour `anon`.
--
-- Sans impact fonctionnel : `anon` n'a aucun accès aux tables gardées par
-- is_staff() (content_version, ingestion_*, lesson_artifact) ; la fonction
-- reste disponible pour `authenticated` (requise par les policies) et
-- `service_role`. 100 % ADDITIVE / réversible.

revoke execute on function public.is_staff() from anon;

-- ── Rollback ─────────────────────────────────────────────────────────
-- grant execute on function public.is_staff() to anon;
