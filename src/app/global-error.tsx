'use client';

// Frontière d'erreur RACINE — durcissement Release Candidate.
// Remplace le layout défaillant : doit rendre son propre <html>/<body>.

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('global-error', error?.digest ?? error?.message);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#1e293b',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <p style={{ fontSize: 48, margin: 0 }}>⚠️</p>
          <h1 style={{ color: '#1a237e', fontSize: 22 }}>Application indisponible</h1>
          <p style={{ fontSize: 14, color: '#475569' }}>
            Une erreur inattendue est survenue. Réessaie dans un instant.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              background: '#1a237e',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
