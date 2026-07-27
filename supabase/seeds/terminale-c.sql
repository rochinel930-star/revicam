-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — seed de démonstration : ajouter « Terminale C »
-- ═══════════════════════════════════════════════════════════════════
-- Preuve du principe « config, pas duplication » (DoD P2) : ajouter une
-- classe se fait UNIQUEMENT par insertion de lignes — aucun changement de
-- schéma, aucun code. Idempotent (on conflict), sûr à ré-exécuter.
--
-- Prérequis : migrations 0007–0014 appliquées (programme/niveau/serie
-- « cameroun-minesec » seedés).

-- Classe Terminale C, rattachée niveau Terminale + série C.
insert into classes (slug, nom, ordre, programme_id, niveau_id, serie_id)
select
  'terminale-c',
  'Terminale C',
  60,
  pr.id,
  (select n.id from niveau n where n.programme_id = pr.id and n.code = 'terminale'),
  (select s.id from serie  s where s.programme_id = pr.id and s.code = 'C')
from programme pr
where pr.code = 'cameroun-minesec'
on conflict (slug) do update
  set nom = excluded.nom,
      programme_id = excluded.programme_id,
      niveau_id = excluded.niveau_id,
      serie_id = excluded.serie_id;

-- Rattacher une matière existante (Physique) à la nouvelle classe.
insert into classe_matieres (classe_id, matiere_id, coefficient)
select c.id, m.id, 4
from classes c, matieres m
where c.slug = 'terminale-c' and m.slug = 'physique'
on conflict (classe_id, matiere_id) do nothing;

-- Un chapitre (module) pour cette classe : programme_id est rempli par le
-- trigger fn_default_programme_from_classe(). Aucune duplication de schéma.
insert into modules (classe_id, matiere_id, numero, titre)
select c.id, m.id, 1, 'Cinématique du point'
from classes c, matieres m
where c.slug = 'terminale-c' and m.slug = 'physique'
on conflict (classe_id, matiere_id, numero) do nothing;
