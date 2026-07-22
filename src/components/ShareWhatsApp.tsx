'use client';

// Partage du score sur WhatsApp (lien wa.me pré-rempli) — croissance organique.
import { SITE_NAME, SITE_URL } from '@/lib/config';

export default function ShareWhatsApp({ note20, titre }: { note20: number; titre: string }) {
  const texte = `💪 J'ai eu ${Number.isInteger(note20) ? note20 : note20.toFixed(1)}/20 à « ${titre} » sur ${SITE_NAME} ! Compose toi aussi gratuitement, comme en salle d'examen : ${SITE_URL}`;
  const href = `https://wa.me/?text=${encodeURIComponent(texte)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow hover:opacity-90"
    >
      💬 Partager mon score sur WhatsApp
    </a>
  );
}
