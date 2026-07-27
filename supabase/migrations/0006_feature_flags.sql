-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0006 : feature flags (Phase P1 — durcissement)
-- ═══════════════════════════════════════════════════════════════════
-- Introduit un mécanisme de bascule de comportement (feature flags)
-- persistant en base. Le code garde des VALEURS PAR DÉFAUT (foyer unique
-- dans src/lib/flags.ts) ; cette table ne sert qu'à SURCHARGER un défaut
-- sans redéploiement.
--
-- Discipline (secret-by-default) : la table de base n'est lisible par
-- personne côté client. Le frontend/serveur lit uniquement la vue
-- `feature_flags_public`, exposée en lecture seule (les flags ne sont pas
-- des secrets, mais on garde le contrat « rien de public sans vue »).
--
-- Additif et réversible (rollback en bas). Aucune donnée existante touchée.

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean     not null default false,
  description text        not null default '',
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Surcharge des défauts de src/lib/flags.ts. Résolution : env > table > défaut code.';

-- RLS : verrou par défaut. Aucune policy d'écriture → seul service_role
-- (qui contourne la RLS) peut modifier les flags. Aucune lecture directe
-- anon/authenticated sur la table de base.
alter table public.feature_flags enable row level security;

-- Vue publique en lecture seule (contrat « accès public via vue »).
create or replace view public.feature_flags_public as
  select key, enabled, description
  from public.feature_flags;

-- Droits : rien sur la table de base pour anon/authenticated ; SELECT sur la vue.
revoke all privileges on table public.feature_flags        from anon, authenticated;
revoke all privileges on table public.feature_flags_public from anon, authenticated;
grant  select          on table public.feature_flags_public to   anon, authenticated;

-- ── Rollback (si besoin) ────────────────────────────────────────────
-- drop view if exists public.feature_flags_public;
-- drop table if exists public.feature_flags;
