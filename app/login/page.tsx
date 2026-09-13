import { login } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold font-heading leading-9 tracking-tight text-primary">
          D-QUINCA
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          Connexion à votre espace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        {message && (
          <div className="mb-6 p-4 rounded-md text-sm font-medium text-center bg-danger/10 text-danger border border-danger/20">
            {message}
          </div>
        )}

        <form className="space-y-6" action={login}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-foreground">
              Adresse e-mail
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-foreground-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-foreground">
              Mot de passe
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-foreground-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Se connecter
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-xs text-foreground-muted">
          Compte non reconnu ? Contactez votre administrateur — les comptes D-QUINCA sont
          créés exclusivement par l&apos;équipe Demba Solution.
        </p>
      </div>
    </div>
  )
}
