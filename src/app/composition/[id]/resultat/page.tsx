import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import ResultatClient from '@/components/ResultatClient';

export const metadata = { title: 'Résultat de composition' };
export const dynamic = 'force-dynamic';

export default async function PageResultat({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { attempt } = await searchParams;
  if (!attempt) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb
        miettes={[{ href: '/composition', label: 'Salle de Composition' }, { label: 'Résultat' }]}
      />
      <ResultatClient attemptId={attempt} />
    </div>
  );
}
