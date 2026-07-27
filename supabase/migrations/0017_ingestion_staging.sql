-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0017 : staging d'ingestion V2 (Phase P4)
-- ═══════════════════════════════════════════════════════════════════
-- Tables ISOLÉES du pipeline d'ingestion. Le pipeline n'écrit QUE ici,
-- jamais dans le contenu de production. La promotion vers le contenu est
-- une étape humaine séparée. Secret-by-default : lecture réservée au staff,
-- écriture via service_role. 100 % ADDITIVE.

create table ingestion_job (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  type         text not null check (type in ('epreuve','lecon')),
  statut       text not null default 'valide'
               check (statut in ('valide','invalide','promu','rejete')),
  content_hash text not null unique,          -- idempotence (dédup)
  created_at   timestamptz not null default now()
);

create table ingestion_artifact (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references ingestion_job(id) on delete cascade,
  mime       text not null,
  bytes      int  not null default 0,
  texte      text,
  created_at timestamptz not null default now()
);
create index ingestion_artifact_job_idx on ingestion_artifact(job_id);

create table ingestion_extraction (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references ingestion_job(id) on delete cascade,
  payload     jsonb not null,
  score       numeric not null default 0,
  suggestions jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index ingestion_extraction_job_idx on ingestion_extraction(job_id);

create table ingestion_review (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null unique references ingestion_job(id) on delete cascade,
  statut     text not null default 'en_attente'
             check (statut in ('en_attente','accepte','rejete')),
  reviewer   uuid references auth.users(id) on delete set null,
  note       text,
  decided_at timestamptz
);

-- ── RLS : staff uniquement (secret-by-default) ───────────────────────
alter table ingestion_job        enable row level security;
alter table ingestion_artifact   enable row level security;
alter table ingestion_extraction enable row level security;
alter table ingestion_review     enable row level security;

create policy "staff lit les jobs"        on ingestion_job        for select using (is_staff());
create policy "staff lit les artefacts"   on ingestion_artifact   for select using (is_staff());
create policy "staff lit les extractions" on ingestion_extraction for select using (is_staff());
create policy "staff lit les revues"      on ingestion_review     for select using (is_staff());
-- Le staff décide en revue (accepte/rejete) ; la promotion reste serveur.
create policy "staff décide en revue"     on ingestion_review     for update using (is_staff()) with check (is_staff());

-- Moindre privilège : aucun accès anon ; authenticated filtré par is_staff().
revoke all privileges on table ingestion_job, ingestion_artifact, ingestion_extraction, ingestion_review
  from anon, authenticated;
grant  select on table ingestion_job, ingestion_artifact, ingestion_extraction to authenticated;
grant  select, update on table ingestion_review to authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop table if exists ingestion_review, ingestion_extraction, ingestion_artifact, ingestion_job;
