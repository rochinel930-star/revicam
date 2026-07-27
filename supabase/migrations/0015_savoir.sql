-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0015 : graphe de connaissances (notions/compétences)
-- ═══════════════════════════════════════════════════════════════════
-- Phase P3 (WS-DATA). Introduit le socle du savoir : notion, compétence,
-- objectif APC. Foyer unique : « une notion = un chapitre » (unique
-- (chapitre_id, code)). 100 % ADDITIVE.

-- ── Notion (unité de savoir rattachée à un chapitre) ─────────────────
create table notion (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  chapitre_id  uuid not null references modules(id)   on delete cascade,
  code         text not null,
  nom          text not null,
  unique (chapitre_id, code)
);
create index notion_programme_idx on notion(programme_id);
create index notion_chapitre_idx  on notion(chapitre_id);

-- ── Compétence (APC : savoir-faire transversal) ──────────────────────
create table competence (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  code         text not null,
  nom          text not null,
  domaine      text,
  unique (programme_id, code)
);
create index competence_programme_idx on competence(programme_id);

-- ── Objectif APC (objectif pédagogique rattaché à une compétence) ────
create table objectif_apc (
  id            uuid primary key default gen_random_uuid(),
  programme_id  uuid not null references programme(id)  on delete cascade,
  competence_id uuid references competence(id)          on delete set null,
  code          text not null,
  enonce        text not null,
  unique (programme_id, code)
);
create index objectif_apc_competence_idx on objectif_apc(competence_id);

-- ── RLS : référentiel du savoir en lecture publique ──────────────────
alter table notion       enable row level security;
alter table competence   enable row level security;
alter table objectif_apc enable row level security;

create policy "lecture publique" on notion       for select using (true);
create policy "lecture publique" on competence   for select using (true);
create policy "lecture publique" on objectif_apc for select using (true);

revoke all privileges on table notion, competence, objectif_apc from anon, authenticated;
grant  select on table notion, competence, objectif_apc to anon, authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop table if exists objectif_apc;
-- drop table if exists competence;
-- drop table if exists notion;
