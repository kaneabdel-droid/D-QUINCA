import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/auth'
import { createAdminIdentityMiddlewareClient } from '@/utils/supabase/admin-identity'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const { pathname } = request.nextUrl

  // /admin/login est le point d'entrée dédié de l'espace admin : jamais soumis
  // aux redirections ci-dessous (sinon boucle de redirection avec lui-même).
  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Espace admin plateforme : réservé aux emails listés dans ADMIN_EMAILS. Traité
  // avant la redirection générique ci-dessous pour qu'un visiteur non connecté sur
  // /admin/* atterrisse sur /admin/login, pas sur /login (compte entreprise/magasin).
  //
  // SSO admin inter-produits DembaSolution : on vérifie d'abord la session
  // partagée (cookie à domaine .dembasolution.com, cf. admin-identity.ts) posée
  // par une connexion sur SIGGIE ; si absente, on retombe sur la session admin
  // locale à D-QUINCA (compat, /admin/login local reste fonctionnel) ; si aucune
  // des deux, on renvoie vers la connexion centralisée sur SIGGIE avec un retour.
  if (pathname.startsWith('/admin')) {
    const adminIdentitySupabase = createAdminIdentityMiddlewareClient(request, supabaseResponse)
    const { data: { user: sharedAdminUser } } = await adminIdentitySupabase.auth.getUser()

    if (isAdminEmail(sharedAdminUser?.email) || isAdminEmail(user?.email)) {
      return supabaseResponse
    }

    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    const returnTo = `https://d-quinca.dembasolution.com${pathname}${request.nextUrl.search}`
    return NextResponse.redirect(
      `https://www.dembasolution.com/admin/login?next=${encodeURIComponent(returnTo)}`
    )
  }

  // Pas d'auto-inscription côté D-QUINCA (tous les comptes sont créés par l'admin
  // système, cf. §4 du plan) : ni /signup ni verrouillage d'essai à gérer ici,
  // seulement les routes publiques de connexion/récupération de mot de passe.
  if (
    !user &&
    pathname !== '/' &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/forgot-password') &&
    !pathname.startsWith('/update-password') &&
    !pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
