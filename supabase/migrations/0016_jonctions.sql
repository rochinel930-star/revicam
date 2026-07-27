-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0016 : jonctions du graphe + vue de traversée
-- ═══════════════════════════════════════════════════════════════════
-- Phase P3. Relie contenu et savoir : leçon↔notion, question↔notion,
-- notion↔compétence, épreuve↔compétence. Fournit la vue de traversée
-- notion → chapitre → classe → programme → pays. 100 % ADDITIVE.
--
-- Sécurité : les liens de contenu public (leçon/notion, notion/compétence,
-- épreuve/compétence) sont lisibles. `question_notion` est SECRET (il
-- révèle la structure des compositions) → server/staff uniquement.

create table lecon_notion (
  lecon_id  uuid not null references lecons(id) on delete cascade,
  notion_id uuid not null references notion(id) on delete cascade,
  primary key (lecon_id, notion_id)
);
create index lecon_notion_notion_idx on lecon_notion(notion_id);

create table question_notion (
  question_id uuid not null references questions(id) on delete cascade,
  notion_id   uuid not null references notion(id)    on delete cascade,
  primary key (question_id, notion_id)
);
create index question_notion_notion_idx on question_notion(notion_id);

create table notion_competence (
  notion_id     uuid not null references notion(id)     on delete cascade,
  competence_id uuid not null references competence(id) on delete cascade,
  primary key (notion_id, competence_id)
);
create index notion_competence_comp_idx on notion_competence(competence_id);

create table epreuve_competence (
  epreuve_id    uuid not null references epreuves(id)   on delete cascade,
  competence_id uuid not null references competence(id) on delete cascade,
  primary key (epreuve_id, competence_id)
);
create index epreuve_competence_comp_idx on epreuve_competence(competence_id);

-- ── Vue de traversée : notion → chapitre → classe → programme → pays ─
create view v_notion_chaine
with (security_barrier) as
  select
    n.id    as notion_id,
    n.code  as notion_code,
    n.nom   as notion_nom,
    m.id    as chapitre_id,
    m.titre as chapitre_titre,
    c.id    as classe_id,
    c.slug  as classe_slug,
    pr.id   as programme_id,
    pr.code as programme_code,
    p.id    as pays_id,
    p.code  as pays_code
  from notion n
  join modules   m  on m.id  = n.chapitre_id
  join classes   c  on c.id  = m.classe_id
  join programme pr on pr.id = n.programme_id
  join pays      p  on p.id  = pr.pays_id;

-- ── RLS & grants ─────────────────────────────────────────────────────
alter table lecon_notion       enable row level security;
alter table question_notion    enable row level security;
alter table notion_competence  enable row level security;
alter table epreuve_competence enable row level security;

-- Liens publics.
create policy "lecture publique" on lecon_notion       for select using (true);
create policy "lecture publique" on notion_competence  for select using (true);
create policy "lecture publique" on epreuve_competence for select using (true);
-- question_notion : aucune policy (secret) → server_role/staff seulement.

revoke all privileges on table lecon_notion, notion_competence, epreuve_competence from anon, authenticated;
grant  select on table lecon_notion, notion_competence, epreuve_competence to anon, authenticated;
revoke all privileges on table question_notion from anon, authenticated;

grant select on v_notion_chaine to anon, authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop view if exists v_notion_chaine;
-- drop table if exists epreuve_competence, notion_competence, question_notion, lecon_notion;
