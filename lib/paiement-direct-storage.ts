/**
 * Module d'Encaissement Direct sur Appareils & Comptes de la Quincaillerie (Zéro Agrégateur)
 * D-QUINCA — Économie de 100% des frais de commission d'agrégateur (2% à 3.5% préservés)
 */

export interface CompteMarchandDirect {
  id: string;
  type: 'wave' | 'orange_money' | 'free_money' | 'tpe_banque';
  nom: string;
  numeroOuCode: string;
  banqueOuOperateur: string;
  pointDeVente: string;
  actif: boolean;
  qrCodeData?: string;
  instructions?: string;
}

export interface TransactionDirecte {
  id: string;
  date: string;
  heure: string;
  montant: number;
  devise: string;
  methode: 'wave' | 'orange_money' | 'free_money' | 'tpe_carte' | 'especes';
  methodeLibelle: string;
  referenceExterne: string; // ID transaction Wave, ID Orange Money, N° Autorisation STAN TPE
  terminalOuCompteNom: string;
  clientNom: string;
  commandeRef: string; // Vente / Bon de livraison / Facture
  pointDeVente: string;
  caissier: string;
  statut: 'valide' | 'annule';
  fraisAggregateurEconomises: number; // 2.5% du montant préservés
  notes?: string;
}

const STORAGE_KEY_COMPTES = 'dquinca_comptes_marchands_directs';
const STORAGE_KEY_TRANSACTIONS = 'dquinca_transactions_directes';

export const COMPTES_MARCHANDS_DEFAUT: CompteMarchandDirect[] = [
  {
    id: 'cpt-wave-quinca',
    type: 'wave',
    nom: 'Wave Marchand Caisse Quincaillerie',
    numeroOuCode: '+221 77 340 00 00',
    banqueOuOperateur: 'Wave Business Sénégal',
    pointDeVente: 'Caisse Comptoir Principal',
    actif: true,
    qrCodeData: 'https://pay.wave.com/m/M_sn_quincaillerie_centrale',
    instructions: 'Scanner le QR Wave ou envoyer au numéro marchand direct de la quincaillerie',
  },
  {
    id: 'cpt-om-quinca',
    type: 'orange_money',
    nom: 'Orange Money Marchand Quincaillerie',
    numeroOuCode: '672910',
    banqueOuOperateur: 'Orange Money Sénégal',
    pointDeVente: 'Caisse Comptoir Principal',
    actif: true,
    instructions: 'Composer #144#391*672910*Montant# ou scanner le QR code officiel du magasin',
  },
  {
    id: 'cpt-tpe-quinca-cbao',
    type: 'tpe_banque',
    nom: 'TPE Bancaire Caisse CBAO #01',
    numeroOuCode: 'TPE-CBAO-QUINCA-01',
    banqueOuOperateur: 'CBAO Attijariwafa Bank (Visa / Mastercard / GIM-UEMOA)',
    pointDeVente: 'Caisse Comptoir Principal',
    actif: true,
    instructions: 'Insérer ou approcher la carte bancaire sur le terminal CBAO du comptoir',
  },
  {
    id: 'cpt-tpe-depot-mat',
    type: 'tpe_banque',
    nom: 'TPE Mobile Dépôt Matériaux & Gros',
    numeroOuCode: 'TPE-BOA-DEPOT-02',
    banqueOuOperateur: 'Bank of Africa (BOA) Sénégal',
    pointDeVente: 'Dépôt Matériaux & Gros Volumes',
    actif: true,
    instructions: 'Terminal mobile autonome pour enlèvements fers, ciments et gros œuvres',
  },
  {
    id: 'cpt-free-quinca',
    type: 'free_money',
    nom: 'Free Money Marchand',
    numeroOuCode: '81230',
    banqueOuOperateur: 'Free Money Sénégal',
    pointDeVente: 'Caisse Comptoir Principal',
    actif: false,
    instructions: 'Code Marchand Free Money direct',
  },
];

export const TRANSACTIONS_DIRECTES_DEFAUT: TransactionDirecte[] = [
  {
    id: 'TX-QNC-2026-001',
    date: '2026-11-13',
    heure: '09:40',
    montant: 285000,
    devise: 'XOF',
    methode: 'wave',
    methodeLibelle: 'Wave Direct Marchand (0% agrégateur)',
    referenceExterne: 'W-981240182',
    terminalOuCompteNom: 'Wave Marchand Caisse Quincaillerie',
    clientNom: 'Entreprise BTP Sahel Pro',
    commandeRef: 'VNT-2026-0084 (Fer à béton & Ciment)',
    pointDeVente: 'Caisse Comptoir Principal',
    caissier: 'Mamadou Ba',
    statut: 'valide',
    fraisAggregateurEconomises: 7125, // 285 000 * 2.5%
    notes: 'Paiement direct Wave vérifié sur smartphone marchand caisse',
  },
  {
    id: 'TX-QNC-2026-002',
    date: '2026-11-13',
    heure: '10:15',
    montant: 42500,
    devise: 'XOF',
    methode: 'orange_money',
    methodeLibelle: 'Orange Money Direct (Code 672910)',
    referenceExterne: 'MP261113.1015.C44102',
    terminalOuCompteNom: 'Orange Money Marchand Quincaillerie',
    clientNom: 'M. Alioune Fall (Artisan)',
    commandeRef: 'VNT-2026-0085 (Plomberie & Raccords)',
    pointDeVente: 'Caisse Comptoir Principal',
    caissier: 'Aissatou Diallo',
    statut: 'valide',
    fraisAggregateurEconomises: 1063,
    notes: 'Code marchand composé au comptoir, SMS de confirmation reçu',
  },
  {
    id: 'TX-QNC-2026-003',
    date: '2026-11-13',
    heure: '11:00',
    montant: 1450000,
    devise: 'XOF',
    methode: 'tpe_carte',
    methodeLibelle: 'TPE Carte Bancaire CBAO (STAN: 088192)',
    referenceExterne: 'STAN-088192 / AUTH-551029',
    terminalOuCompteNom: 'TPE Bancaire Caisse CBAO #01',
    clientNom: 'Société Générale de Travaux (SGT)',
    commandeRef: 'VNT-2026-0086 (Lot outillage électroportatif & EPI)',
    pointDeVente: 'Caisse Comptoir Principal',
    caissier: 'Mamadou Ba',
    statut: 'valide',
    fraisAggregateurEconomises: 36250, // 1 450 000 * 2.5%
    notes: 'Carte bancaire d’entreprise sur TPE physique CBAO. Ticket agrafé au bon de commande.',
  },
  {
    id: 'TX-QNC-2026-004',
    date: '2026-11-13',
    heure: '11:30',
    montant: 75000,
    devise: 'XOF',
    methode: 'especes',
    methodeLibelle: 'Espèces / Caisse Directe',
    referenceExterne: 'ESP-1130-C1',
    terminalOuCompteNom: 'Tiroir-Caisse Comptoir',
    clientNom: 'Client Particulier',
    commandeRef: 'VNT-2026-0087 (Peintures & Enduits)',
    pointDeVente: 'Caisse Comptoir Principal',
    caissier: 'Aissatou Diallo',
    statut: 'valide',
    fraisAggregateurEconomises: 0,
    notes: 'Règlement en billets, monnaie rendue immédiatement.',
  },
];

export function getComptesMarchandsDirects(): CompteMarchandDirect[] {
  if (typeof window === 'undefined') return COMPTES_MARCHANDS_DEFAUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(COMPTES_MARCHANDS_DEFAUT));
      return COMPTES_MARCHANDS_DEFAUT;
    }
    return JSON.parse(raw);
  } catch {
    return COMPTES_MARCHANDS_DEFAUT;
  }
}

export function saveCompteMarchandDirect(compte: CompteMarchandDirect): void {
  if (typeof window === 'undefined') return;
  const existants = getComptesMarchandsDirects();
  const index = existants.findIndex((c) => c.id === compte.id);
  let maj: CompteMarchandDirect[];
  if (index >= 0) {
    maj = [...existants];
    maj[index] = compte;
  } else {
    maj = [compte, ...existants];
  }
  localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(maj));
}

export function supprimerCompteMarchandDirect(id: string): void {
  if (typeof window === 'undefined') return;
  const existants = getComptesMarchandsDirects();
  const maj = existants.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(maj));
}

export function getTransactionsDirectes(): TransactionDirecte[] {
  if (typeof window === 'undefined') return TRANSACTIONS_DIRECTES_DEFAUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(TRANSACTIONS_DIRECTES_DEFAUT));
      return TRANSACTIONS_DIRECTES_DEFAUT;
    }
    return JSON.parse(raw);
  } catch {
    return TRANSACTIONS_DIRECTES_DEFAUT;
  }
}

export function enregistrerTransactionDirecte(tx: Omit<TransactionDirecte, 'id' | 'fraisAggregateurEconomises'>): TransactionDirecte {
  const fraisAggregateurEconomises = tx.methode === 'especes' ? 0 : Math.round(tx.montant * 0.025);
  const nouvelle: TransactionDirecte = {
    ...tx,
    id: `TX-QNC-${Date.now().toString().slice(-6)}`,
    fraisAggregateurEconomises,
  };

  if (typeof window !== 'undefined') {
    const existantes = getTransactionsDirectes();
    const maj = [nouvelle, ...existantes];
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(maj));
  }
  return nouvelle;
}

export function getTotalEconomiesAggregateurs(): { totalEncaisseDirect: number; totalEconomise: number; nombreTransactions: number } {
  const txs = getTransactionsDirectes();
  const valides = txs.filter((t) => t.statut === 'valide');
  const totalEncaisseDirect = valides.reduce((sum, t) => sum + t.montant, 0);
  const totalEconomise = valides.reduce((sum, t) => sum + t.fraisAggregateurEconomises, 0);
  return {
    totalEncaisseDirect,
    totalEconomise,
    nombreTransactions: valides.length,
  };
}

