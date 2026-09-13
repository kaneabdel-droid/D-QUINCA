'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClient } from './actions'

export default function DeleteClientButton({ id, nom }: { id: string; nom: string }) {
  async function handleDelete() {
    if (!confirm(`Supprimer le client "${nom}" ?`)) return
    const res = await deleteClient(id)
    if (res?.error) toast.error(res.error)
    else toast.success('Client supprimé')
  }

  return (
    <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title="Supprimer">
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
