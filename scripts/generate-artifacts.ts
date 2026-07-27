// Génération des artefacts IA par leçon — Phase P8 (à l'écriture).
//
//   npm run generate            (toutes les leçons publiées)
//
// Génère 1×/leçon, valide déterministiquement, met en cache (mutualisé). Sans
// adaptateur LLM enregistré (clé absente), rapporte « indisponible » et sort
// proprement — les étapes déterministes de validation restent la vérité.
//
// Un fournisseur concret s'enregistre ici via enregistrerAdapter(...) selon les
// clés d'environnement (non inclus : cf. dette TD-007). Aucune écriture en prod
// n'est déclenchée automatiquement par le build.

import 'dotenv/config';
import { sbAdmin } from '../src/lib/supabase';
import { construireContexteLecon } from '../src/lib/lesson-context';
import { genererArtefactsLecon } from '../src/lib/ai/generate-artifacts';
import { creerPersisteurArtefacts } from '../src/lib/ai/artifacts-persist';
import { sousBudget } from '../src/lib/ai/cost';
import { adapterActif } from '../src/lib/ai/adapter';
import type { Lecon } from '../src/lib/types';

interface LigneLecon extends Lecon {
  modules?: { numero: number; titre: string; classes?: { nom: string }; matieres?: { nom: string } };
}

async function main() {
  if (!adapterActif().disponible()) {
    console.log('⚠️  Aucun adaptateur LLM disponible — génération ignorée (validation déterministe prête).');
    return;
  }

  const sb = sbAdmin();
  const { data, error } = await sb
    .from('lecons')
    .select(
      'id, module_id, numero, titre, slug, duree_lecture_min, objectifs, contenu_mdx, essentiel_mdx, jeu_bilingue, qcm, exercices, publie, ' +
        'modules!inner(numero, titre, classes!inner(nom), matieres!inner(nom))'
    )
    .eq('publie', true);
  if (error) throw error;

  const persisteur = creerPersisteurArtefacts(sb);
  let total = 0;

  for (const ligne of (data as unknown as LigneLecon[]) ?? []) {
    const ctx = construireContexteLecon({
      lecon: ligne,
      matiere: ligne.modules?.matieres?.nom ?? '',
      classe: ligne.modules?.classes?.nom ?? '',
      chapitre: `Module ${ligne.modules?.numero ?? '?'} — ${ligne.modules?.titre ?? ''}`,
    });

    const { artefacts, erreurs, coutTotalEur } = await genererArtefactsLecon(ctx);
    if (!sousBudget(coutTotalEur)) {
      console.warn(`⚠️  ${ligne.slug}: budget dépassé (${coutTotalEur.toFixed(4)} €) — vérifier les prompts.`);
    }
    for (const a of artefacts) {
      await persisteur.upsert(a);
      total++;
    }
    console.log(
      `• ${ligne.slug}: ${artefacts.length} artefact(s), ${erreurs.length} erreur(s), coût ~${coutTotalEur.toFixed(4)} €`
    );
  }

  console.log(`\n✅ ${total} artefact(s) mis en cache.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
