-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — seed : classes standard de l'enseignement secondaire général
-- ═══════════════════════════════════════════════════════════════════
-- Peuple `classes` pour toute la scolarité (6e → Terminale A/C/D), rattachées
-- au programme cameroun-minesec + niveau + série. « Ajouter une classe =
-- insertion de lignes ». Idempotent (on conflict slug). Prérequis : 0007–0014.

insert into classes (slug, nom, ordre, programme_id, niveau_id, serie_id)
select
  v.slug, v.nom, v.ordre, pr.id,
  (select id from niveau n where n.programme_id = pr.id and n.code = v.niveau),
  case when v.serie is null then null
       else (select id from serie s where s.programme_id = pr.id and s.code = v.serie) end
from programme pr,
     (values
        ('sixieme',    '6ᵉ',          10, 'sixieme',   null),
        ('cinquieme',  '5ᵉ',          20, 'cinquieme', null),
        ('quatrieme',  '4ᵉ',          30, 'quatrieme', null),
        ('troisieme',  '3ᵉ',          40, 'troisieme', null),
        ('seconde',    'Seconde',     50, 'seconde',   null),
        ('premiere-a', 'Première A',  60, 'premiere',  'A'),
        ('premiere-c', 'Première C',  61, 'premiere',  'C'),
        ('premiere-d', 'Première D',  62, 'premiere',  'D'),
        ('terminale-a','Terminale A', 70, 'terminale', 'A'),
        ('terminale-c','Terminale C', 71, 'terminale', 'C'),
        ('terminale-d','Terminale D', 72, 'terminale', 'D')
     ) as v(slug, nom, ordre, niveau, serie)
where pr.code = 'cameroun-minesec'
on conflict (slug) do update
  set nom = excluded.nom, ordre = excluded.ordre,
      programme_id = excluded.programme_id,
      niveau_id = excluded.niveau_id, serie_id = excluded.serie_id;
