'use client';

// Page de repli hors-ligne — Phase P5. Servie par le service worker quand
// une navigation échoue sans réseau. Bilingue fr/en.

import Card from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { t } from '@/lib/i18n';

export default function PageOffline() {
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="text-center">
        <p className="text-4xl">📡</p>
        <h1 className="mt-2 text-xl font-bold text-navy">
          {t('offline.title', 'fr')}
          <span className="mt-1 block text-sm font-normal text-slate-400">
            {t('offline.title', 'en')}
          </span>
        </h1>
        <p className="mt-3 text-sm text-slate-600">{t('offline.body', 'fr')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('offline.body', 'en')}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>{t('offline.retry', 'fr')}</Button>
          <ButtonLink href="/" variante="secondaire">
            {t('offline.home', 'fr')}
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
