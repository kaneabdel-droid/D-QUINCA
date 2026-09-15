import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="font-heading text-3xl font-bold text-foreground">D-QUINCA</h1>
      <p className="mt-2 max-w-md text-foreground-muted">
        La solution de gestion pour quincailleries en Afrique. Suivez vos stocks, vos ventes et vos
        magasins en toute simplicité.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          S&apos;abonner
        </Link>
        <Link href="/decouvrir-dquinca" className="text-sm font-semibold text-foreground-muted hover:text-primary">
          Découvrir →
        </Link>
      </div>

      <div id="fonctionnalites" className="mt-20 grid w-full max-w-3xl gap-6 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Stock en temps réel</h2>
          <p className="mt-1 text-sm text-foreground-muted">Suivez vos entrées et sorties, magasin par magasin, sans feuille de calcul.</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Ventes &amp; achats</h2>
          <p className="mt-1 text-sm text-foreground-muted">Facturez vos clients, gérez vos fournisseurs, suivez créances et dettes.</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Plusieurs magasins</h2>
          <p className="mt-1 text-sm text-foreground-muted">Une vue consolidée de toute votre entreprise, et le détail par magasin.</p>
        </div>
      </div>
    </div>
  );
}
