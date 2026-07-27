// État de chargement global — durcissement Release Candidate.

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-500" role="status" aria-live="polite">
      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy" />
      Chargement…
    </div>
  );
}
