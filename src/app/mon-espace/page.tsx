import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import MonEspaceClient from '@/components/MonEspaceClient';

export const metadata: Metadata = {
  title: 'Mon espace',
  description: 'Ta progression de révision et l’historique de tes compositions.',
};

export default function PageMonEspace() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb miettes={[{ label: 'Mon espace' }]} />
      <h1 className="mb-1 text-2xl font-bold text-navy">👤 Mon espace</h1>
      <p className="mb-5 text-sm text-slate-600">
        Ta progression est enregistrée sur cet appareil, sans compte ni inscription.
      </p>
      <MonEspaceClient />
    </div>
  );
}
