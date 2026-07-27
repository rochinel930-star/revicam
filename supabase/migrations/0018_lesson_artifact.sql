-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0018 : artefacts IA par leçon (Phase P8)
-- ═══════════════════════════════════════════════════════════════════
-- Stocke les objets pédagogiques GÉNÉRÉS UNE FOIS par leçon (QCM,
-- flashcards, vrai/faux, questions ouvertes, explications) et mutualisés
-- entre tous les élèves. Runtime élève = LECTURE du cache (0 appel IA).
--
-- Clé de cache/mutualisation : (lecon_id, type, signature) où
--   signature = hash(prompt_version + lesson_version + type).
-- Un changement de contenu de leçon change lesson_version → nouvelle
-- signature → régénération ; les élèves lisent toujours la version courante.
--
-- Secret-by-default : la table de base est SECRÈTE (elle contient `secret`,
-- p. ex. les rubriques de correction des questions ouvertes). Les élèves
-- lisent uniquement la vue `lesson_artifact_public` (payload visible, jamais
-- `secret`), et seulement pour les leçons publiées. 100 % ADDITIVE.

create table lesson_artifact (
  id              uuid primary key default gen_random_uuid(),
  lecon_id        uuid not null references lecons(id) on delete cascade,
  type            text not null check (type in
                    ('qcm','flashcards','vrai_faux','questions_ouvertes','explications')),
  signature       text not null,     -- hash(prompt_v + lesson_v + type)
  lesson_version  text not null,     -- signature de contenu de la leçon
  prompt_version  text not null,
  payload         jsonb not null,    -- partie PUBLIQUE (servie aux élèves)
  secret          jsonb,             -- partie SECRÈTE (rubriques de correction)
  provenance      jsonb not null default '{}',
  cost_tokens     int  not null default 0,
  cost_eur        numeric not null default 0,
  modele          text,
  created_at      timestamptz not null default now(),
  unique (lecon_id, type, signature)
);
create index lesson_artifact_lecon_type_idx on lesson_artifact(lecon_id, type);

-- Vue publique : payload uniquement, leçons publiées uniquement.
create view lesson_artifact_public
with (security_barrier) as
  select a.id, a.lecon_id, a.type, a.signature, a.lesson_version, a.payload
  from lesson_artifact a
  join lecons l on l.id = a.lecon_id
  where l.publie = true;

-- ── RLS & grants ─────────────────────────────────────────────────────
alter table lesson_artifact enable row level security;
create policy "staff lit les artefacts" on lesson_artifact for select using (is_staff());

revoke all privileges on table lesson_artifact        from anon, authenticated;
revoke all privileges on table lesson_artifact_public from anon, authenticated;
grant  select on table lesson_artifact_public to anon, authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop view if exists lesson_artifact_public;
-- drop table if exists lesson_artifact;
