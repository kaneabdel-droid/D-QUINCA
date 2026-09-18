'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import type { EntrepriseHeader } from '@/lib/auth/getCurrentUserContext'
import ReleveModal from './ReleveModal'

export type ReleveType = 'client' | 'fournisseur'

export default function ReleveButton({
  releveType,
  magasinId,
  entreprise,
  devise,
  referenceId,
  referenceNom,
  dict,
}: {
  releveType: ReleveType
  magasinId: string | null
  entreprise: EntrepriseHeader
  devise: string
  referenceId: string
  referenceNom: string
  dict: Dictionary
}) {
  const [isOpen, setIsOpen] = useState(false)
  const t = dict.releves

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-foreground-muted hover:text-primary p-1" title={t.buttonLabel}>
        <FileText className="h-4 w-4" />
      </button>

      {isOpen && (
        <ReleveModal
          onClose={() => setIsOpen(false)}
          releveType={releveType}
          magasinId={magasinId}
          entreprise={entreprise}
          devise={devise}
          referenceId={referenceId}
          referenceNom={referenceNom}
          dict={dict}
        />
      )}
    </>
  )
}
