'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; venteId?: string; error?: string }

type Ligne = { article_id: string; quantite: number; prix_unitaire: number }

export async function creerVente(
  clientId: string | null,
  modePaiement: 'comptant' | 'credit' | 'mixte',
  montantPaye: number,
  lignes: Ligne[]
): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  if (lignes.length === 0) return { error: 'Ajoutez au moins une ligne' }

  const { data, error } = await supabase.rpc('creer_vente', {
    p_magasin_id: context.magasinId,
    p_client_id: clientId,
    p_mode_paiement: modePaiement,
    p_montant_paye: montantPaye,
    p_lignes: lignes,
  })

  if (error) return { error: error.message }

  revalidatePath('/ventes')
  revalidatePath('/stock')
  revalidatePath('/creances')
  revalidatePath('/tresorerie')
  return { success: true, venteId: data as string }
}

export async function annulerVente(venteId: string): Promise<ActionResult> {
  await requireGerant()
  const supabase = await createClient()

  // Annulation simple par changement de statut : ne restaure pas le stock ni la
  // trésorerie automatiquement (une vraie contre-écriture serait une évolution
  // future) — signalé comme telle dans la confirmation côté client.
  const { error } = await supabase.from('ventes').update({ statut: 'annulee' }).eq('id', venteId)
  if (error) return { error: error.message }

  revalidatePath('/ventes')
  return { success: true }
}
