'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteFournisseur } from './actions'

export default function DeleteFournisseurButton({ id, nom }: { id: string; nom: string }) {
  async function handleDelete() {
    if (!confirm(`Supprimer le fournisseur "${nom}" ?`)) return
    const res = await deleteFournisseur(id)
    if (res?.error) toast.error(res.error)
    else toast.success('Fournisseur supprimé')
  }

  return (
    <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title="Supprimer">
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
