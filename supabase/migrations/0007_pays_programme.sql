-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0007 : socle Données V2 — pays / programme / niveau
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2 (WS-DATA). Première des 8 migrations additives qui font passer
-- le schéma mono-programme (Cameroun / Première D) au référentiel
-- configurable 6e→Terminale et multi-pays.
--
-- Principe directeur : « config, pas duplication ». Ajouter une classe,
-- une série ou un pays = INSÉRER des lignes, jamais dupliquer du schéma.
--
-- 100 % ADDITIVE : uniquement des CREATE. Aucune table existante n'est
-- modifiée ici. Réversible (rollback en bas).

-- ── Pays ─────────────────────────────────────────────────────────────
create table pays (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,          -- ISO-3166 alpha-2, ex. « CM »
  nom  text not null
);

-- ── Programme (système éducatif d'un pays) ───────────────────────────
-- config jsonb : réglages spécifiques au programme (barème, langue, règles
-- d'examen…) sans multiplier les colonnes.
create table programme (
  id      uuid primary key default gen_random_uuid(),
  pays_id uuid not null references pays(id) on delete cascade,
  code    text not null unique,        -- ex. « cameroun-minesec »
  nom     text not null,
  config  jsonb not null default '{}'
);
create index programme_pays_idx on programme(pays_id);

-- ── Niveau (classe abstraite du programme : 6e … Terminale) ──────────
-- Distinct de `classes` (instance concrète slugée du site). Un niveau
-- porte l'ordre pédagogique et le cycle.
create table niveau (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  code         text not null,          -- ex. « premiere », « terminale »
  nom          text not null,          -- ex. « Première »
  cycle        text,                   -- ex. « second-cycle »
  ordre        int  not null default 0,
  unique (programme_id, code)
);
create index niveau_programme_idx on niveau(programme_id);

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop table if exists niveau;
-- drop table if exists programme;
-- drop table if exists pays;
