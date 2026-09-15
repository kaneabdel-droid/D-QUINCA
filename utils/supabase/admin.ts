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

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: undiciFetch as unknown as typeof fetch },
  })
}
