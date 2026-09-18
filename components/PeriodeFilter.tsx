import type { Dictionary } from '@/dictionaries'

// Formulaire GET simple (pas de client component nécessaire) : soumis, il
// recharge la page serveur avec ?from=&to=, que chaque page.tsx utilise pour
// filtrer sa requête Supabase — le même filtre sert donc à l'affichage écran
// et à l'impression (le bouton d'impression n'imprime que les lignes déjà
// chargées pour cette période).
export default function PeriodeFilter({
  from,
  to,
  dict,
  hiddenParams,
}: {
  from?: string
  to?: string
  dict: Dictionary
  hiddenParams?: Record<string, string>
}) {
  const t = dict.impression

  return (
    <form className="flex flex-wrap items-end gap-2">
      {hiddenParams &&
        Object.entries(hiddenParams).map(([nom, valeur]) => <input key={nom} type="hidden" name={nom} value={valeur} />)}
      <div>
        <label className="block text-xs text-foreground-muted mb-1">{t.du}</label>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ''}
          className="rounded-md bg-background border border-surface-border text-foreground px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-foreground-muted mb-1">{t.au}</label>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ''}
          className="rounded-md bg-background border border-surface-border text-foreground px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-surface border border-surface-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background"
      >
        {t.filtrer}
      </button>
      {(from || to) && (
        <a href="?" className="text-xs text-foreground-muted hover:text-primary underline underline-offset-2">
          {t.reinitialiser}
        </a>
      )}
    </form>
  )
}
