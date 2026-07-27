// Unitaire i18n — Phase P5.

import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n';

describe('i18n', () => {
  it('traduit en français par défaut', () => {
    expect(t('offline.retry')).toBe('Réessayer');
  });
  it('traduit en anglais quand demandé', () => {
    expect(t('offline.retry', 'en')).toBe('Retry');
  });
  it('fournit fr et en pour chaque clé utilisée', () => {
    for (const key of ['offline.title', 'offline.body', 'offline.retry', 'offline.home'] as const) {
      expect(t(key, 'fr').length).toBeGreaterThan(0);
      expect(t(key, 'en').length).toBeGreaterThan(0);
    }
  });
});
