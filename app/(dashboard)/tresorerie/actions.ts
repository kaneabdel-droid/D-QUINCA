'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addCompteTresorerie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  const typeCompte = formData.get('type_compte') as string
  const soldeInitial = parseFloat(formData.get('solde_initial') as string) || 0

  if (!nom) return { error: 'Le nom est requis' }

  const { error } = await supabase.from('comptes_tresorerie').insert({
    magasin_id: context.magasinId,
    nom,
    type_compte: typeCompte,
    solde_initial: soldeInitial,
  })
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

// Écriture manuelle : virement entre comptes ou mouvement "autre" non couvert
// par les RPC dédiées (creer_vente/creer_achat/regler_creance/regler_dette
// écrivent déjà leur propre ligne de journal automatiquement).
export async function addEcritureTresorerie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  const compteId = formData.get('compte_tresorerie_id') as string
  const typeMouvement = formData.get('type_mouvement') as string
  const montant = parseFloat(formData.get('montant') as string) || 0
  const categorie = (formData.get('categorie') as string) || 'autre'
  const motif = (formData.get('motif') as string)?.trim() || null

  if (!compteId) return { error: 'Un compte est requis' }
  if (montant <= 0) return { error: 'Le montant doit être positif' }

  const { error } = await supabase.from('journal_tresorerie').insert({
    magasin_id: context.magasinId,
    compte_tresorerie_id: compteId,
    type_mouvement: typeMouvement,
    montant,
    categorie,
    motif,
    utilisateur_id: context.userId,
  })
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}
