-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0012 : versionnage de contenu + provenance + staff
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Historise le contenu (leçons) de façon APPEND-ONLY, avec
-- empreinte (content_hash), chaînage parent, statut et provenance. Fournit
-- les fonctions de snapshot et de RESTAURATION (DoD P2 : « restauration de
-- version testée »). Introduit le rôle applicatif `staff` (is_staff()).
--
-- Secret-by-default : content_version et staff sont VERROUILLÉS (RLS en
-- 0013, aucune lecture anon). 100 % ADDITIVE.

-- ── Journal des versions (append-only) ───────────────────────────────
create table content_version (
  id                uuid primary key default gen_random_uuid(),
  entity_type       text not null check (entity_type in ('lecon')),
  entity_id         uuid not null,
  version           int  not null,
  content_hash      text not null,
  parent_version_id uuid references content_version(id) on delete set null,
  statut            text not null default 'publie'
                    check (statut in ('brouillon','publie','archive')),
  snapshot          jsonb not null,
  provenance        jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);
create index content_version_entity_idx on content_version(entity_type, entity_id);

-- FK différée de lecons.current_version_id (colonne créée en 0010).
alter table lecons
  add constraint lecons_current_version_fk
  foreign key (current_version_id) references content_version(id) on delete set null;

-- ── Garantie append-only : interdire UPDATE/DELETE ───────────────────
-- (service_role compris : l'historique est immuable. Une correction crée
--  une nouvelle version, jamais une mutation.)
create or replace function fn_content_version_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'content_version est append-only : UPDATE/DELETE interdit (créer une nouvelle version)';
end;
$$;

create trigger trg_content_version_no_update
  before update on content_version
  for each row execute function fn_content_version_immutable();

create trigger trg_content_version_no_delete
  before delete on content_version
  for each row execute function fn_content_version_immutable();

-- ── Snapshot d'une leçon → nouvelle version ──────────────────────────
create or replace function fn_snapshot_lecon(
  p_lecon_id uuid,
  p_provenance jsonb default '{}'::jsonb
) returns uuid language plpgsql as $$
declare
  v_lecon    lecons%rowtype;
  v_version  int;
  v_parent   uuid;
  v_hash     text;
  v_new_id   uuid;
  v_statut   text;
begin
  select * into v_lecon from lecons where id = p_lecon_id;
  if not found then
    raise exception 'fn_snapshot_lecon : leçon % introuvable', p_lecon_id;
  end if;

  select coalesce(max(version), 0) + 1
    into v_version
  from content_version
  where entity_type = 'lecon' and entity_id = p_lecon_id;

  -- Parent = version la plus récente (max(uuid) n'existe pas en SQL).
  select id into v_parent
  from content_version
  where entity_type = 'lecon' and entity_id = p_lecon_id
  order by version desc
  limit 1;

  v_hash := md5(
    coalesce(v_lecon.titre, '') ||
    coalesce(v_lecon.contenu_mdx, '') ||
    coalesce(v_lecon.essentiel_mdx, '') ||
    coalesce(v_lecon.qcm::text, '') ||
    coalesce(v_lecon.exercices::text, '')
  );
  v_statut := case when v_lecon.publie then 'publie' else 'brouillon' end;

  insert into content_version (
    entity_type, entity_id, version, content_hash, parent_version_id, statut, snapshot, provenance
  ) values (
    'lecon', p_lecon_id, v_version, v_hash, v_parent, v_statut, to_jsonb(v_lecon), p_provenance
  ) returning id into v_new_id;

  update lecons set current_version_id = v_new_id where id = p_lecon_id;
  return v_new_id;
end;
$$;

-- ── Restauration d'une leçon depuis une version ──────────────────────
-- Réapplique le contenu d'une version passée puis enregistre une NOUVELLE
-- version (l'historique reste append-only et traçable).
create or replace function fn_restore_lecon_version(p_version_id uuid)
returns uuid language plpgsql as $$
declare
  v_cv content_version%rowtype;
  s    jsonb;
begin
  select * into v_cv from content_version where id = p_version_id;
  if not found then
    raise exception 'fn_restore_lecon_version : version % introuvable', p_version_id;
  end if;
  s := v_cv.snapshot;

  update lecons set
    titre             = s->>'titre',
    slug              = s->>'slug',
    duree_lecture_min = nullif(s->>'duree_lecture_min','')::int,
    objectifs         = coalesce(s->'objectifs', '[]'::jsonb),
    contenu_mdx       = s->>'contenu_mdx',
    essentiel_mdx     = s->>'essentiel_mdx',
    jeu_bilingue      = s->'jeu_bilingue',
    qcm               = s->'qcm',
    exercices         = s->'exercices',
    publie            = coalesce((s->>'publie')::boolean, false)
  where id = v_cv.entity_id;

  return fn_snapshot_lecon(
    v_cv.entity_id,
    jsonb_build_object('action', 'restore', 'source_version_id', p_version_id, 'source_version', v_cv.version)
  );
end;
$$;

-- ── Rôle applicatif « staff » ────────────────────────────────────────
create table staff (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  cree_le  timestamptz not null default now()
);

-- SECURITY DEFINER : utilisable dans les policies RLS sans accorder aux
-- rôles anon/authenticated un accès direct à la table staff (secret-by-default).
create or replace function is_staff()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from staff s where s.user_id = auth.uid());
$$;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop function if exists is_staff();
-- drop table if exists staff;
-- drop function if exists fn_restore_lecon_version(uuid);
-- drop function if exists fn_snapshot_lecon(uuid, jsonb);
-- drop trigger if exists trg_content_version_no_delete on content_version;
-- drop trigger if exists trg_content_version_no_update on content_version;
-- drop function if exists fn_content_version_immutable();
-- alter table lecons drop constraint if exists lecons_current_version_fk;
-- drop table if exists content_version;
