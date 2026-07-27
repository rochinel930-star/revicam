-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0008 : série first-class + rattachement des classes
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Introduit la SÉRIE comme entité de premier ordre (A, C, D…)
-- et rattache les `classes` existantes au référentiel V2 (programme,
-- niveau, série) SANS rien casser : colonnes nullable, backfill en 0014.
--
-- 100 % ADDITIVE : create table serie + add column nullable. Les inserts
-- existants (import) qui ne fournissent pas ces colonnes restent valides.

-- ── Série (filière d'examen : A, C, D, TI…) ──────────────────────────
create table serie (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  code         text not null,          -- ex. « D »
  nom          text not null,          -- ex. « Série D »
  unique (programme_id, code)
);
create index serie_programme_idx on serie(programme_id);

-- ── Rattachement des classes au référentiel V2 (nullable → backfill 0014)
alter table classes
  add column programme_id uuid references programme(id) on delete restrict,
  add column niveau_id    uuid references niveau(id)    on delete restrict,
  add column serie_id     uuid references serie(id)     on delete restrict;

create index classes_programme_idx on classes(programme_id);
create index classes_niveau_idx    on classes(niveau_id);
create index classes_serie_idx     on classes(serie_id);

-- ── Rollback ─────────────────────────────────────────────────────────
-- alter table classes
--   drop column if exists serie_id,
--   drop column if exists niveau_id,
--   drop column if exists programme_id;
-- drop table if exists serie;
