import React from 'react'
import type { Metadata } from 'next'
import { AssistantImport, type TypeImportOption } from '@/components/import/AssistantImport'
import { importerDonneesQuinca } from './actions'

export const metadata: Metadata = {
  title: 'Importer des données existantes — D-QUINCA',
}

const OPTIONS_QUINCA: TypeImportOption[] = [
  {
    id: 'articles',
    titre: 'Articles & Stocks initiaux',
    description: 'Catalogue d’articles de quincaillerie, références, catégories, prix et quantités en stock',
    icone: 'article',
    nomFichierModele: 'modele_import_articles_stocks.csv',
    modeleCSV: `designation;reference;categorie;unite;prix_vente;quantite;seuil_alerte
Ciment SOCOCIM 50kg;SOC-50KG;Matériaux de construction;sac;4800;200;20
Fer à béton 10mm barre 12m;FER-10MM;Gros oeuvre;barre;3600;150;15
Peinture Blanche Mat 20L;PEINT-BLANC-20L;Peinture & Finition;pot;18500;45;5
Cadenas Haute Sécurité 50mm;CAD-50MM;Quincaillerie générale;unite;3200;60;10
Tuyau PVC Pression DN 40 4m;PVC-40MM;Plomberie;barre;2400;100;15`
  },
  {
    id: 'fournisseurs',
    titre: 'Fournisseurs & Grossistes',
    description: 'Fournisseurs de matériaux et outillage, numéros de téléphone et adresses',
    icone: 'fournisseur',
    nomFichierModele: 'modele_import_fournisseurs.csv',
    modeleCSV: `nom;telephone;adresse
SOCOCIM INDUSTRIES;+221 33 839 88 88;Rufisque, Sénégal
AFRICA METALS SÉNÉGAL;+221 33 824 10 10;Zone Industrielle Km 11, Dakar
COMPTOIR DU TUBE ET FER;+221 77 555 44 33;Colobane, Dakar`
  },
  {
    id: 'clients',
    titre: 'Clients & Artisans',
    description: 'Clients particuliers, artisans maçons, plombiers, entreprises BTP',
    icone: 'client',
    nomFichierModele: 'modele_import_clients.csv',
    modeleCSV: `nom;telephone;adresse
Entreprise BTP Diagne & Frères;+221 77 645 12 34;Almadies, Dakar
Ousmane Ndiaye (Artisan Maçon);+221 76 543 21 00;Guédiawaye Arrêt Double Less
Fatou Camara;+221 78 987 65 43;Grand Yoff, Dakar`
  }
]

export default function PageImportQuinca() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AssistantImport
        nomApplication="D-QUINCA"
        titreModule="Assistant d'Importation de Données Existantes"
        optionsTypes={OPTIONS_QUINCA}
        onImporter={importerDonneesQuinca}
      />
    </div>
  )
}
