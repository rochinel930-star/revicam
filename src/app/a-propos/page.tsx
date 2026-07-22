import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { SITE_NAME, WHATSAPP_CONTACT, WHATSAPP_CONTACT_DISPLAY } from '@/lib/config';

export const metadata: Metadata = {
  title: 'À propos',
  description: `${SITE_NAME} : la mission, l'équipe et le contact.`,
};

export default function PageAPropos() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb miettes={[{ label: 'À propos' }]} />
      <h1 className="mb-4 text-2xl font-bold text-navy">À propos de {SITE_NAME}</h1>

      <div className="space-y-4 rounded-lg bg-white p-5 text-sm leading-relaxed shadow-sm">
        <p>
          <strong>{SITE_NAME}</strong> est né d’un constat simple : au Probatoire, une seule
          note en dessous de 10/20 suffit à faire échouer une année entière. Pourtant, la
          plupart des élèves découvrent leurs points faibles… le jour de l’examen.
        </p>
        <p>
          Notre mission : que chaque élève camerounais puisse <strong>lire son cours</strong>,{' '}
          <strong>composer comme en salle d’examen</strong> et{' '}
          <strong>recevoir sa note immédiatement</strong> — gratuitement, sans inscription,
          même avec un petit forfait data et un téléphone d’entrée de gamme.
        </p>
        <p>
          Les cours suivent l’Approche Par Compétences (APC) des programmes officiels du
          MINESEC, avec la terminologie exacte que tu retrouves en classe : situation de vie,
          évaluation des ressources, évaluation des compétences, jeu bilingue.
        </p>
        <p>
          La V1 couvre la <strong>Première D</strong> (préparation au Probatoire D). Les
          autres classes et séries arrivent progressivement.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-gold bg-gold-bg p-5 text-center">
        <h2 className="font-bold text-slate-800">Une question ? Une épreuve à proposer ?</h2>
        <p className="mt-1 text-sm text-slate-600">Écris-nous directement sur WhatsApp :</p>
        <a
          href={`https://wa.me/${WHATSAPP_CONTACT.replace('+', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow hover:opacity-90"
        >
          💬 {WHATSAPP_CONTACT_DISPLAY}
        </a>
      </div>
    </div>
  );
}
