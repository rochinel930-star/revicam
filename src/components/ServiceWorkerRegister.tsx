'use client';

// Enregistrement du service worker — Phase P5 (offline-first).
// Uniquement en production (évite les caches parasites en développement).

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* enregistrement best-effort : ne jamais bloquer l'app */
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
