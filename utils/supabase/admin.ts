import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetch as undiciFetch } from 'undici'

// Client "service role" utilisé uniquement par les routes/actions serveur de l'espace
// /admin : création de comptes (auth.admin.createUser), suppression d'entreprise,
// écriture sur entreprises/magasins/utilisateurs (tables sans policy insert/update/delete
// exposée à `authenticated` — voir supabase/migrations/09_rls_policies.sql). Ce client
// contourne le RLS : ne jamais l'importer depuis du code exécuté côté client.
//
// `fetch` explicite (undici direct, pas le global patché par Next.js pour son cache de
// données) : les requêtes POST avec corps JSON (insert, auth.admin.*) échouaient de façon
// systématique en production avec "TypeError: fetch failed" / AuthRetryableFetchError,
// alors que les mêmes appels réussissaient toujours hors de ce pipeline Next.js — cohérent
// avec un problème connu du fetch patché par Next.js sur les requêtes avec body.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant : requis pour les opérations admin (création de comptes, entreprises)')
  }

  // TEMPORAIRE, diagnostic uniquement — @supabase/auth-js ne garde que
  // `error.message` de ce que `fetch` lève et jette le `.cause` d'origine
  // (voir node_modules/@supabase/auth-js/dist/main/lib/fetch.js:130), donc la
  // vraie cause réseau (code, errno...) était invisible même en capturant
  // l'erreur côté appelant. On l'injecte dans le message pour la récupérer.
  const diagnosticFetch: typeof fetch = async (...args) => {
    try {
      return await (undiciFetch as unknown as typeof fetch)(...args)
    } catch (e) {
      const cause = (e as { cause?: unknown })?.cause as { code?: string; message?: string; errno?: unknown } | undefined
      const detail = JSON.stringify({ code: cause?.code, causeMessage: cause?.message, errno: cause?.errno })
      throw new Error(`fetch failed | ${detail}`)
    }
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: diagnosticFetch },
  })
}
