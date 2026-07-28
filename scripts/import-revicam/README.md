# Pipeline d'ingestion documentaire RéviCam (local)

Importe les fichiers moissonnés (`fichiers_telecharges/`) dans la table
`epreuves` de Supabase : dédup MD5 → classification Gemini (sampling par taille +
vision de secours) → miniature WebP → Storage → insertion (`valide=false`).

## Installation (Windows, Python 3.12+)
```bash
cd scripts/import-revicam
py -m venv .venv && .venv\Scripts\activate
py -m pip install -r requirements.txt
copy .env.example .env   # puis renseigner SUPABASE_SERVICE_ROLE_KEY + GEMINI_API_KEY
```

## Lancement
```bash
# 1) Test à blanc (classification seule, aucune écriture) — VALIDER LA PRÉCISION
py pipeline_import_revicam.py --dossier ../../fichiers_telecharges --limit 10 --dry-run

# 2) Écriture réelle d'un petit lot (valide=false → invisible au public)
py pipeline_import_revicam.py --dossier ../../fichiers_telecharges --limit 10
```

## Principes
- **Garde de revue** : tout est inséré `valide=false` → **invisible au public**
  tant que non validé (RLS `using(valide=true)`). La validation se fera en lot.
- **Économie** : établissements normalisés par dictionnaire local (gratuit) ;
  chaîne de modèles `flash-lite-latest → 3.1-flash-lite → flash-latest` avec
  repli sur quota (429) / retrait (404) ; sampling limité (2–5 pages).
- **Anti-doublon** : `hash_md5` unique (fichier binaire identique = skip).
- **Zéro régression** : écrit dans la table `epreuves` EXISTANTE (relationnelle),
  mappe classe/matière vers le référentiel (auto-création si absent).

## Étapes suivantes (après validation du pilote)
- Concurrence contrôlée (sémaphore) + reprise sur `registre_epreuves.json`.
- Filigrane vectoriel (option `--watermark`, à finaliser).
- UI de revue en lot dans `/admin` pour passer `valide=true`.
