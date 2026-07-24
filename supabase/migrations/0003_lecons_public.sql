-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0003 : vue publique des leçons (Phase 0, sécurité)
-- ═══════════════════════════════════════════════════════════════════
-- Problème corrigé : la RLS `lecons using(true)` exposait le CONTENU des
-- leçons non publiées (dont les réponses de QCM et les corrigés d'exercices)
-- via l'API anon, alors que l'UI affiche « en rédaction ».
--
-- Solution (même patron que questions_public) : une vue qui expose TOUJOURS
-- les métadonnées (titre, numéro, objectifs — nécessaires au programme et à
-- l'écran « en rédaction ») mais met le contenu à NULL tant que publie=false.
-- Le client anon lira cette vue ; la table de base sera restreinte ensuite
-- (migration 0004), une fois le code déployé.
--
-- ⚠️ Cette migration est purement ADDITIVE : elle ne casse rien. La table
-- `lecons` reste lisible tel quel jusqu'à 0004.

create view lecons_public
with (security_barrier)
as
  select
    id, module_id, numero, titre, slug, duree_lecture_min, objectifs, publie,
    case when publie then contenu_mdx   end as contenu_mdx,
    case when publie then essentiel_mdx end as essentiel_mdx,
    case when publie then jeu_bilingue  end as jeu_bilingue,
    case when publie then qcm           end as qcm,
    case when publie then exercices     end as exercices
  from lecons;

grant select on lecons_public to anon, authenticated;
