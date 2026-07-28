#!/usr/bin/env python3
"""
Pipeline d'ingestion documentaire RéviCam (local).

Transforme les fichiers moissonnés (fichiers_telecharges/) en lignes structurées
dans la table `epreuves` de Supabase, avec dédup MD5, classification Gemini
(sampling par taille + vision de secours), miniature, et garde de revue
(valide=false).

Usage :
    py pipeline_import_revicam.py --dossier fichiers_telecharges --limit 10 --dry-run
    py pipeline_import_revicam.py --dossier fichiers_telecharges --limit 10   # écrit en base
    py pipeline_import_revicam.py --dossier fichiers_telecharges --watermark   # + filigrane

Prérequis : voir requirements.txt et .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
GEMINI_API_KEY). N'écrit JAMAIS de contenu publié : valide=false → invisible au
public tant que non validé en revue.
"""
from __future__ import annotations
import argparse, hashlib, io, json, os, re, time, unicodedata
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client
from etablissements import normaliser_etablissement

load_dotenv()
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
SB_URL = os.environ["SUPABASE_URL"]
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "epreuves"

# Chaîne de modèles économiques (repli auto sur quota 429 / retrait 404).
CHAINE_ECO = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest"]

client = genai.Client(api_key=GEMINI_KEY)
sb = create_client(SB_URL, SB_KEY)

PROMPT = """Tu classes un DOCUMENT scolaire du secondaire général camerounais (APC) à partir de son EN-TÊTE / ses premières pages.
Développe TOUJOURS les abréviations d'établissement (ex: "COL VOGT" -> "Collège François-Xavier Vogt"). Examen national -> "Officiel MINESEC".
Renvoie STRICTEMENT ce JSON :
{"type_document":"Epreuve|Corrige|Recueil|Fascicule|Manuel",
 "enseignement":"Général|Technique STT|Technique ESTP",
 "niveau_cycle":"Second Cycle|Premier Cycle",
 "classe":"Terminale D|Première C|3ème|...",
 "matiere":"Mathématiques|Physique|Chimie|SVTEEHB|Informatique|Français|Anglais|Philosophie|Histoire-Géographie|ECM|...",
 "etablissement":"Nom complet ou 'Officiel MINESEC'",
 "examen_contexte":"BAC|Probatoire|BEPC|Séquence 1..6|Examen Blanc|Composition",
 "annee_session":"2026|2015-2025",
 "est_apc":true,"contient_situation_probleme":false,"contient_corrige":true,
 "mots_cles":["...","..."],
 "titre_harmonise":"[Revicam] · Type · Matière · Classe - Établissement (mention)"}"""

# ── Résolution du référentiel (classe / matière -> id, auto-création) ────
NIVEAU_SLUG = {"terminale": "terminale", "première": "premiere", "premiere": "premiere",
               "seconde": "seconde", "3": "troisieme", "4": "quatrieme", "5": "cinquieme", "6": "sixieme"}
MATIERE_SLUG = {"mathematiques": "maths", "maths": "maths", "physique": "physique", "chimie": "chimie",
                "physique-chimie": "pct", "pct": "pct", "svteehb": "svteehb", "svt": "svteehb",
                "francais": "francais", "anglais": "anglais", "philosophie": "philosophie",
                "histoire-geographie": "histoire-geographie", "histoire": "histoire",
                "geographie": "geographie", "informatique": "informatique", "ecm": "ecm",
                "espagnol": "espagnol", "allemand": "allemand", "economie": "economie"}
_cache: dict[str, str] = {}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def classe_slug(txt: str) -> str | None:
    t = (txt or "").lower()
    niveau = next((v for k, v in NIVEAU_SLUG.items() if k in t), None)
    if not niveau:
        return None
    serie = next((s for s in ["a", "c", "d", "e", "ti"] if re.search(rf"\b{s}\b", t)), None)
    return f"{niveau}-{serie}" if (niveau in ("premiere", "terminale") and serie) else niveau


def resoudre_id(table: str, slug: str, nom: str) -> str:
    key = f"{table}:{slug}"
    if key in _cache:
        return _cache[key]
    r = sb.table(table).select("id").eq("slug", slug).execute()
    if r.data:
        _cache[key] = r.data[0]["id"]
    else:  # auto-création (config, pas duplication)
        ins = sb.table(table).insert({"slug": slug, "nom": nom}).execute()
        _cache[key] = ins.data[0]["id"]
    return _cache[key]


def mapper_type(examen: str) -> tuple[str, int | None]:
    t = (examen or "").lower()
    m = re.search(r"s[ée]quence\s*(\d)", t)
    if m:
        return "sequentielle", int(m.group(1))
    if "blanc" in t:
        return "blanc", None
    if "bac" in t:
        return "baccalaureat", None
    if "probatoire" in t:
        return "probatoire", None
    if "bepc" in t:
        return "bepc", None
    if "composition" in t:
        return "composition", None
    return "officiel", None


# ── Extraction texte / vision selon la taille (sampling métier) ──────────
def sampling_pages(n: int) -> int:
    return 2 if n <= 3 else 3 if n <= 8 else 5


def extraire_entete(path: Path) -> tuple[str, bytes | None, int]:
    """Renvoie (texte_entete, png_page1_si_scan, nombre_pages)."""
    doc = fitz.open(path)
    n = doc.page_count
    texte = "".join(doc[i].get_text() for i in range(min(sampling_pages(n), n)))
    png = None
    if len(texte.strip()) < 100:  # scan/photo -> vision multimodale
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.4, 1.4))
        png = pix.tobytes("png")
    doc.close()
    return texte[:6000], png, n


def miniature_webp(path: Path) -> bytes:
    doc = fitz.open(path)
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.0, 1.0))
    doc.close()
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        img.thumbnail((420, 594))
        out = io.BytesIO()
        img.save(out, "WEBP", quality=70, method=6)
        return out.getvalue()
    except Exception:
        return pix.tobytes("jpg")  # repli si Pillow absent


# ── Appel Gemini avec repli de modèle + backoff sur 429 ─────────────────
def classer_ia(texte: str, png: bytes | None) -> dict:
    contents = ([types.Part.from_bytes(data=png, mime_type="image/png"), PROMPT]
                if png else [f"{PROMPT}\n\nDOCUMENT:\n{texte}"])
    cfg = types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
    derniere = None
    for modele in CHAINE_ECO:
        for essai in range(2):
            try:
                r = client.models.generate_content(model=modele, contents=contents, config=cfg)
                return json.loads(r.text)
            except Exception as e:  # noqa
                derniere = e
                msg = str(e)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    time.sleep(12); continue
                if "404" in msg or "NOT_FOUND" in msg:
                    break  # modèle suivant
                break
    raise RuntimeError(f"Classification IA échouée : {derniere}")


# ── Traitement d'un fichier ─────────────────────────────────────────────
def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def deja_en_base(h: str) -> bool:
    return bool(sb.table("epreuves").select("id").eq("hash_md5", h).limit(1).execute().data)


def traiter(path: Path, dry_run: bool, watermark: bool) -> dict:
    h = md5(path)
    if deja_en_base(h):
        return {"skip": "doublon", "fichier": path.name}

    texte, png, n = extraire_entete(path)
    meta = classer_ia(texte, png)

    etab = normaliser_etablissement(texte) or meta.get("etablissement") or "Établissement à préciser"
    cslug = classe_slug(meta.get("classe", "")) or "seconde"
    mslug = MATIERE_SLUG.get(slugify(meta.get("matiere", "")), slugify(meta.get("matiere", "")) or "autres")
    type_ep, num_seq = mapper_type(meta.get("examen_contexte", ""))
    annee_txt = str(meta.get("annee_session") or "")
    annee_int = int(annee_txt) if annee_txt.isdigit() else None
    serie = next((s for s in ["A", "C", "D", "E", "TI"] if re.search(rf"\b{s}\b", meta.get("classe", ""))), None)

    ligne = {
        "hash_md5": h,
        "nom_original": path.name,
        "titre": meta.get("titre_harmonise") or path.stem,
        "titre_harmonise": meta.get("titre_harmonise"),
        "type": type_ep, "type_document": meta.get("type_document"),
        "numero_sequence": num_seq, "annee": annee_int, "annee_session": annee_txt or None,
        "serie": serie, "etablissement": etab,
        "enseignement": meta.get("enseignement", "Général"), "niveau_cycle": meta.get("niveau_cycle"),
        "est_apc": bool(meta.get("est_apc")),
        "contient_situation_probleme": bool(meta.get("contient_situation_probleme")),
        "contient_corrige": bool(meta.get("contient_corrige")),
        "mots_cles": meta.get("mots_cles") or [],
        "nombre_pages": n, "taille_fichier_mo": round(path.stat().st_size / 1e6, 2),
        "composable": False, "valide": False,
    }

    if dry_run:
        return {"dry_run": True, "titre": ligne["titre"], "classe": cslug, "matiere": mslug,
                "type": type_ep, "etab": etab, "type_doc": ligne["type_document"]}

    ligne["classe_id"] = resoudre_id("classes", cslug, meta.get("classe", cslug))
    ligne["matiere_id"] = resoudre_id("matieres", mslug, meta.get("matiere", mslug))

    with open(path, "rb") as f:
        sb.storage.from_(BUCKET).upload(f"pdf/{h}.pdf", f.read(),
                                        {"content-type": "application/pdf", "upsert": "true"})
    ligne["pdf_url"] = sb.storage.from_(BUCKET).get_public_url(f"pdf/{h}.pdf")
    try:
        thumb = miniature_webp(path)
        sb.storage.from_(BUCKET).upload(f"thumb/{h}.webp", thumb,
                                        {"content-type": "image/webp", "upsert": "true"})
        ligne["url_thumbnail"] = sb.storage.from_(BUCKET).get_public_url(f"thumb/{h}.webp")
    except Exception as e:  # noqa
        print(f"   (miniature ignorée : {e})")

    sb.table("epreuves").insert(ligne).execute()
    return {"insere": True, "titre": ligne["titre"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dossier", required=True)
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--watermark", action="store_true")
    args = ap.parse_args()

    fichiers = [p for p in sorted(Path(args.dossier).iterdir())
                if p.suffix.lower() in (".pdf",)][: args.limit]
    print(f"{len(fichiers)} fichier(s) — mode {'DRY-RUN' if args.dry_run else 'ÉCRITURE'} "
          f"(modèles: {', '.join(CHAINE_ECO)})\n")
    stats = {"insere": 0, "doublon": 0, "erreur": 0}
    for p in fichiers:
        try:
            r = traiter(p, args.dry_run, args.watermark)
            if r.get("skip"):
                stats["doublon"] += 1; print(f"⏭  {p.name} — doublon")
            elif r.get("dry_run"):
                print(f"✓ {p.name}\n    → {r['titre']}\n    [{r['classe']} · {r['matiere']} · {r['type']} · {r['etab']}]")
            else:
                stats["insere"] += 1; print(f"✅ {p.name}\n    → {r['titre']}")
        except Exception as e:  # noqa
            stats["erreur"] += 1; print(f"❌ {p.name} — {e}")
        time.sleep(0.4)  # respecter le RPM free tier
    print(f"\nBilan : {stats['insere']} insérés, {stats['doublon']} doublons, {stats['erreur']} erreurs.")


if __name__ == "__main__":
    main()
