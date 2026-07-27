'use client';

// Page de connexion — Phase P6. Lien magique par e-mail (sans mot de passe).
// Non bloquant : la connexion est un bonus, pas une obligation.

import { useState } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { envoyerLienConnexion } from '@/lib/auth';
import { t } from '@/lib/i18n';

type Etat = 'saisie' | 'envoi' | 'envoye' | 'erreur';

export default function PageConnexion() {
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState<Etat>('saisie');

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return;
    setEtat('envoi');
    try {
      await envoyerLienConnexion(email.trim());
      setEtat('envoye');
    } catch {
      setEtat('erreur');
    }
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        <h1 className="text-xl font-bold text-navy">{t('auth.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('auth.body')}</p>

        {etat === 'envoye' ? (
          <p className="mt-5 rounded-md bg-svteehb-bg p-3 text-sm font-medium text-slate-800">
            ✅ {t('auth.sent')}
          </p>
        ) : (
          <form onSubmit={soumettre} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
              placeholder="prenom@exemple.cm"
            />
            <Button type="submit" disabled={etat === 'envoi'} className="w-full">
              {etat === 'envoi' ? t('auth.sending') : t('auth.send')}
            </Button>
            {etat === 'erreur' && <p className="text-sm text-red-600">{t('auth.error')}</p>}
          </form>
        )}
      </Card>
    </div>
  );
}
