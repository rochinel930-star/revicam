// Configuration centrale du site — changer le nom de marque ici suffit.

export const SITE_NAME = 'RéviCam';
export const SITE_TAGLINE =
  'Lis ton cours, compose comme en salle d’examen, reçois ta note immédiatement — gratuitement.';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://revicam.vercel.app';

export const WHATSAPP_CONTACT = '+237695604547';
export const WHATSAPP_CONTACT_DISPLAY = '+237 695 60 45 47';

/** Couleur par défaut si une matière n'a pas de couleur en base. */
export const COULEUR_MATIERE_DEFAUT = '#64748B';

/** Seuils de la règle Probatoire : rouge < 10, orange 10–12, vert > 12 (sur 20). */
export function couleurNote(note20: number): string {
  if (note20 < 10) return '#DC2626';
  if (note20 <= 12) return '#EA580C';
  return '#16A34A';
}
