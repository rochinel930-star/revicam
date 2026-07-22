// Cercle de score /20 — code couleur de la règle Probatoire :
// rouge < 10, orange 10–12, vert > 12.
import { couleurNote } from '@/lib/config';

export default function ScoreCircle({ note20 }: { note20: number }) {
  const couleur = couleurNote(note20);
  const pct = Math.min(Math.max(note20 / 20, 0), 1);
  const rayon = 52;
  const circonference = 2 * Math.PI * rayon;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={rayon} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={rayon} fill="none"
          stroke={couleur} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color: couleur }}>
          {Number.isInteger(note20) ? note20 : note20.toFixed(1)}
        </span>
        <span className="text-sm text-slate-500">/ 20</span>
      </div>
    </div>
  );
}
