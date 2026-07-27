// Primitive UI — Card. Design System P5.
// Conteneur de surface cohérent (bordure, ombre, rayon) réutilisable.

import type { ReactNode } from 'react';

export default function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </Tag>
  );
}
