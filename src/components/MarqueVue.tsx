'use client';

// Marque une leçon comme « vue » à l'ouverture de la page.

import { useEffect } from 'react';
import { setProgressLecon } from '@/lib/local';

export default function MarqueVue({ leconId }: { leconId: string }) {
  useEffect(() => {
    setProgressLecon(leconId, {});
  }, [leconId]);
  return null;
}
