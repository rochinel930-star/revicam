-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0001 : schéma complet + RLS + vue publique
-- ═══════════════════════════════════════════════════════════════════

-- ── Référentiel scolaire ─────────────────────────────────────────────

create table classes (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  nom   text not null,
  ordre int  not null default 0
);

create table matieres (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nom         text not null,
  couleur_hex text not null default '#64748B',
  icone       text
);

create table classe_matieres (
  classe_id   uuid not null references classes(id) on delete cascade,
  matiere_id  uuid not null references matieres(id) on delete cascade,
  coefficient numeric,
  primary key (classe_id, matiere_id)
);

create table modules (
  id         uuid primary key default gen_random_uuid(),
  matiere_id uuid not null references matieres(id) on delete cascade,
  classe_id  uuid not null references classes(id) on delete cascade,
  numero     int  not null,
  titre      text not null,
  unique (classe_id, matiere_id, numero)
);

create table lecons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references modules(id) on delete cascade,
  numero            int  not null,
  titre             text not null,
  slug              text not null,
  duree_lecture_min int,
  objectifs         jsonb not null default '[]',
  contenu_mdx       text,
  essentiel_mdx     text,
  jeu_bilingue      jsonb,
  publie            boolean not null default false,
  unique (module_id, numero),
  unique (module_id, slug)
);
create index lecons_module_idx on lecons(module_id);

-- ── Pilier 1 : catalogue d'épreuves ─────────────────────────────────

create table epreuves (
  id              uuid primary key default gen_random_uuid(),
  classe_id       uuid not null references classes(id) on delete cascade,
  matiere_id      uuid not null references matieres(id) on delete cascade,
  type            text not null check (type in ('sequentielle','composition','blanc','officiel','controle')),
  numero_sequence int,
  annee           int not null,
  serie           text,
  etablissement   text,
  titre           text not null,
  pdf_url         text,
  composable      boolean not null default false,
  unique (classe_id, matiere_id, type, annee, titre)
);
create index epreuves_filtres_idx on epreuves(classe_id, matiere_id, type, annee);

create table epreuve_lecons (
  epreuve_id uuid not null references epreuves(id) on delete cascade,
  lecon_id   uuid not null references lecons(id) on delete cascade,
  primary key (epreuve_id, lecon_id)
);

-- ── Pilier 3 : compositions et questions ────────────────────────────

create table compositions (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  titre             text not null,
  matiere_id        uuid not null references matieres(id) on delete cascade,
  classe_id         uuid not null references classes(id) on delete cascade,
  source_epreuve_id uuid references epreuves(id) on delete set null,
  duree_minutes     int  not null default 60,
  bareme_total      numeric not null default 20,
  mode_affichage    text not null default 'liste' check (mode_affichage in ('une_par_une','liste')),
  publie            boolean not null default false
);

create table questions (
  id              uuid primary key default gen_random_uuid(),
  composition_id  uuid not null references compositions(id) on delete cascade,
  lecon_id        uuid references lecons(id) on delete set null,
  ordre           int  not null,
  type            text not null check (type in ('qcm','libre')),
  enonce_mdx      text not null,
  options         jsonb,          -- [{id, texte}] pour qcm
  bonnes_reponses jsonb,          -- ids corrects — JAMAIS servi au client avant soumission
  corrige_type_mdx text,          -- corrigé type pour la correction IA des 'libre'
  bareme          numeric not null default 1,
  unique (composition_id, ordre)
);
create index questions_composition_idx on questions(composition_id);

-- ── Tentatives (anonymes ou liées à un compte) ──────────────────────

create table attempts (
  id             uuid primary key default gen_random_uuid(),
  composition_id uuid not null references compositions(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  anon_id        uuid,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  note_finale    numeric,
  statut         text not null default 'en_cours'
                 check (statut in ('en_cours','soumise','corrigee','correction_partielle'))
);
create index attempts_user_idx on attempts(user_id);
create index attempts_anon_idx on attempts(anon_id);

create table attempt_answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  reponse     jsonb,
  note        numeric,
  feedback_ia jsonb,
  corrigee_at timestamptz,
  unique (attempt_id, question_id)
);

-- ── Progression Pilier 2 ────────────────────────────────────────────

create table lecon_progress (
  id                 uuid primary key default gen_random_uuid(),
  lecon_id           uuid not null references lecons(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete cascade,
  anon_id            uuid,
  statut             text not null default 'vue' check (statut in ('vue','qcm_fait','terminee')),
  meilleur_score_qcm numeric,
  updated_at         timestamptz not null default now()
);
create unique index lecon_progress_user_uq on lecon_progress(lecon_id, user_id) where user_id is not null;
create unique index lecon_progress_anon_uq on lecon_progress(lecon_id, anon_id) where anon_id is not null;

-- ── Profils (comptes optionnels) ────────────────────────────────────

create table profils (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  classe_id uuid references classes(id),
  pseudo    text,
  cree_le   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- VUE PUBLIQUE : questions SANS bonnes_reponses ni corrige_type_mdx
-- Le client ne requête QUE cette vue. La table questions n'a aucune
-- policy de lecture publique.
-- ═══════════════════════════════════════════════════════════════════

create view questions_public
with (security_barrier)
as
  select q.id, q.composition_id, q.lecon_id, q.ordre, q.type,
         q.enonce_mdx, q.options, q.bareme
  from questions q
  join compositions c on c.id = q.composition_id
  where c.publie = true;

grant select on questions_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

alter table classes         enable row level security;
alter table matieres        enable row level security;
alter table classe_matieres enable row level security;
alter table modules         enable row level security;
alter table lecons          enable row level security;
alter table epreuves        enable row level security;
alter table epreuve_lecons  enable row level security;
alter table compositions    enable row level security;
alter table questions       enable row level security;
alter table attempts        enable row level security;
alter table attempt_answers enable row level security;
alter table lecon_progress  enable row level security;
alter table profils         enable row level security;

-- Lecture publique du référentiel et du catalogue
create policy "lecture publique" on classes         for select using (true);
create policy "lecture publique" on matieres        for select using (true);
create policy "lecture publique" on classe_matieres for select using (true);
create policy "lecture publique" on modules         for select using (true);
create policy "lecture publique" on lecons          for select using (true);
create policy "lecture publique" on epreuves        for select using (true);
create policy "lecture publique" on epreuve_lecons  for select using (true);
create policy "lecture publique des compositions publiées" on compositions
  for select using (publie = true);

-- questions : AUCUNE policy de lecture → invisible pour anon/authenticated.
-- La correction lit bonnes_reponses/corrige_type_mdx via service_role
-- (routes API serveur uniquement).

-- Tentatives : un utilisateur connecté ne voit que ses lignes.
-- Les flux anonymes passent exclusivement par les routes API (service_role).
create policy "lire ses tentatives" on attempts
  for select using (user_id = auth.uid());
create policy "lire ses réponses" on attempt_answers
  for select using (
    exists (select 1 from attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );
create policy "lire sa progression" on lecon_progress
  for select using (user_id = auth.uid());
create policy "gérer sa progression" on lecon_progress
  for insert with check (user_id = auth.uid());
create policy "mettre à jour sa progression" on lecon_progress
  for update using (user_id = auth.uid());

-- Profils : chacun le sien
create policy "lire son profil"   on profils for select using (user_id = auth.uid());
create policy "créer son profil"  on profils for insert with check (user_id = auth.uid());
create policy "éditer son profil" on profils for update using (user_id = auth.uid());

-- ── Stockage : bucket public pour les PDF d'épreuves ────────────────
insert into storage.buckets (id, name, public)
values ('epreuves', 'epreuves', true)
on conflict (id) do nothing;
