-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0014 : backfill « Cameroun / MINESEC »
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2, dernière migration. Peuple le référentiel V2 et rattache
-- TOUT l'existant au programme camerounais, puis historise les leçons
-- publiées (version 1). Idempotente (ré-exécutable sans doublon) et
-- non destructive : uniquement des INSERT ... ON CONFLICT et des UPDATE
-- ciblés sur des colonnes nullable encore vides.

-- ── Pays & programme ─────────────────────────────────────────────────
insert into pays (code, nom) values ('CM', 'Cameroun')
  on conflict (code) do nothing;

insert into programme (pays_id, code, nom, config)
  select p.id, 'cameroun-minesec', 'Cameroun — MINESEC (enseignement général)',
         jsonb_build_object('langue_principale','fr','bilingue',true,'note_max',20)
  from pays p where p.code = 'CM'
  on conflict (code) do nothing;

-- ── Niveaux 6e → Terminale ───────────────────────────────────────────
insert into niveau (programme_id, code, nom, cycle, ordre)
select pr.id, v.code, v.nom, v.cycle, v.ordre
from programme pr,
     (values
        ('sixieme',    '6e',        'premier-cycle', 1),
        ('cinquieme',  '5e',        'premier-cycle', 2),
        ('quatrieme',  '4e',        'premier-cycle', 3),
        ('troisieme',  '3e',        'premier-cycle', 4),
        ('seconde',    'Seconde',   'second-cycle',  5),
        ('premiere',   'Première',  'second-cycle',  6),
        ('terminale',  'Terminale', 'second-cycle',  7)
     ) as v(code, nom, cycle, ordre)
where pr.code = 'cameroun-minesec'
on conflict (programme_id, code) do nothing;

-- ── Séries du second cycle ───────────────────────────────────────────
insert into serie (programme_id, code, nom)
select pr.id, v.code, v.nom
from programme pr,
     (values
        ('A',  'Série A (littéraire)'),
        ('C',  'Série C (mathématiques et sciences physiques)'),
        ('D',  'Série D (sciences naturelles)'),
        ('E',  'Série E (mathématiques et technique)'),
        ('TI', 'Série TI (technologie de l''information)')
     ) as v(code, nom)
where pr.code = 'cameroun-minesec'
on conflict (programme_id, code) do nothing;

-- ── Rattacher les classes existantes au programme ────────────────────
update classes
  set programme_id = (select id from programme where code = 'cameroun-minesec')
  where programme_id is null;

-- Cas connu : « premiere-d » → niveau Première, série D.
update classes
  set niveau_id = (select n.id from niveau n
                     join programme pr on pr.id = n.programme_id
                    where pr.code = 'cameroun-minesec' and n.code = 'premiere'),
      serie_id  = (select s.id from serie s
                     join programme pr on pr.id = s.programme_id
                    where pr.code = 'cameroun-minesec' and s.code = 'D')
  where slug = 'premiere-d';

-- ── Propager programme_id aux objets rattachés à une classe ──────────
update modules m
  set programme_id = c.programme_id
  from classes c
  where m.classe_id = c.id and m.programme_id is null;

update epreuves e
  set programme_id = c.programme_id
  from classes c
  where e.classe_id = c.id and e.programme_id is null;

update compositions co
  set programme_id = c.programme_id
  from classes c
  where co.classe_id = c.id and co.programme_id is null;

-- Rattacher les épreuves à une série référentielle quand le texte matche.
update epreuves e
  set serie_id = s.id
  from classes c
  join serie s on s.programme_id = c.programme_id
  where e.classe_id = c.id and e.serie_id is null and s.code = e.serie;

-- ── Rattacher les leçons à leur chapitre (= module) ──────────────────
update lecons set chapitre_id = module_id where chapitre_id is null;

-- ── Historiser les leçons publiées (version 1) ───────────────────────
do $$
declare
  r record;
begin
  for r in select id from lecons where publie = true and current_version_id is null loop
    perform fn_snapshot_lecon(r.id, jsonb_build_object('action','backfill','source','migration-0014'));
  end loop;
end $$;

-- ── Rollback ─────────────────────────────────────────────────────────
-- Les UPDATE ne sont pas trivialement réversibles (remise à null possible).
-- Les INSERT référentiels se suppriment via les rollbacks de 0007/0008.
-- update lecons set chapitre_id = null, current_version_id = null;
-- update modules set programme_id = null; update epreuves set programme_id = null, serie_id = null;
-- update compositions set programme_id = null; update classes set programme_id = null, niveau_id = null, serie_id = null;
