// Génération des artefacts IA par leçon — Phase P8 (à l'écriture).
//
//   npm run generate            (toutes les leçons publiées)
//
// Génère 1×/leçon, valide déterministiquement, met en cache (mutualisé). Sans
// adaptateur LLM enregistré (clé absente), rapporte « indisponible » et sort
// proprement — les étapes déterministes de validation restent la vérité.
//
// Le fournisseur est enregistré ci-dessous selon les clés d'environnement :
// Gemini (palier « bon marché ») si GEMINI_API_KEY est présent.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sbAdmin } from '../src/lib/supabase';
import { construireContexteLecon } from '../src/lib/lesson-context';
import { genererArtefactsLecon } from '../src/lib/ai/generate-artifacts';
import { creerPersisteurArtefacts } from '../src/lib/ai/artifacts-persist';
import { sousBudget } from '../src/lib/ai/cost';
import { adapterActif, enregistrerAdapter } from '../src/lib/ai/adapter';
import { creerGeminiAdapter } from '../src/lib/ai/adapters/gemini';
import type { Lecon } from '../src/lib/types';

interface LigneLecon extends Lecon {
  modules?: { numero: number; titre: string; classes?: { nom: string }; matieres?: { nom: string } };
}

async function main() {
  // Enregistrer l'adaptateur bon marché si la clé est disponible.
  if (process.env.GEMINI_API_KEY) {
    enregistrerAdapter(creerGeminiAdapter());
    console.log(`Adaptateur : gemini (${process.env.GEMINI_MODEL ?? 'gemini-flash-latest'})`);
  }

  if (!adapterActif().disponible()) {
    console.log('⚠️  Aucun adaptateur LLM disponible — génération ignorée (validation déterministe prête).');
    return;
  }

  const sb = sbAdmin();
  const { data, error } = await sb
    .from('lecons')
    .select(
      'id, module_id, numero, titre, slug, duree_lecture_min, objectifs, contenu_mdx, essentiel_mdx, jeu_bilingue, qcm, exercices, publie, ' +
        // Désambiguïsation : depuis P2, lecons a deux FK vers modules
        // (module_id + chapitre_id). On force la relation via module_id.
        'modules!lecons_module_id_fkey!inner(numero, titre, classes!inner(nom), matieres!inner(nom))'
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
    for (const e of erreurs) {
      console.log(`    ✗ ${e.type}: ${e.problemes.slice(0, 4).join(' | ')}`);
    }
  }

  console.log(`\n✅ ${total} artefact(s) mis en cache.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
