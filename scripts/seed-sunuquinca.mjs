// Script de démo unique : crée l'entreprise SUNUQuinca avec 2 magasins et un
// circuit complet achats → stock → ventes → créances/dettes → règlements →
// trésorerie → charges, avec un catalogue d'articles de quincaillerie
// (plomberie, construction, métallurgie, électricité) représentatif de la
// sous-région. Reproduit à la main la logique des RPC creer_vente/creer_achat/
// regler_creance/regler_dette (10_rpc_ventes_achats.sql, 11_rpc_reglements.sql)
// via le client service-role, car ces RPC sont `security invoker` et donc
// inutilisables sans une vraie session utilisateur authentifiée (auth.uid()).
//
// Usage : node scripts/seed-sunuquinca.mjs   (depuis d-quinca/)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const content = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').trim()
  }
  return env
}

const env = loadEnvLocal()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

function insist(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function creerAchat({ magasinId, fournisseurId, modePaiement, montantPaye, lignes, utilisateurId, dateAchat, comptesTresorerie }) {
  const montantTotal = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaireAchat, 0)
  const achat = insist(
    await supabase
      .from('achats')
      .insert({
        magasin_id: magasinId,
        fournisseur_id: fournisseurId,
        mode_paiement: modePaiement,
        montant_total: montantTotal,
        montant_paye: montantPaye,
        statut: 'validee',
        utilisateur_id: utilisateurId,
        date_achat: dateAchat,
      })
      .select()
      .single(),
    'insert achat'
  )

  for (const l of lignes) {
    insist(
      await supabase.from('lignes_achat').insert({
        achat_id: achat.id,
        magasin_id: magasinId,
        article_id: l.articleId,
        quantite: l.quantite,
        prix_unitaire_achat: l.prixUnitaireAchat,
      }),
      'insert ligne_achat'
    )
    insist(
      await supabase.from('mouvements_stock').insert({
        magasin_id: magasinId,
        article_id: l.articleId,
        type_mouvement: 'entree_achat',
        quantite: l.quantite,
        reference_id: achat.id,
        reference_type: 'achat',
        utilisateur_id: utilisateurId,
        created_at: dateAchat,
      }),
      'insert mouvement_stock (achat)'
    )
  }

  const montantRestant = montantTotal - montantPaye
  let detteId = null
  if ((modePaiement === 'credit' || modePaiement === 'mixte') && montantRestant > 0) {
    const dette = insist(
      await supabase
        .from('dettes')
        .insert({
          magasin_id: magasinId,
          fournisseur_id: fournisseurId,
          achat_id: achat.id,
          montant_initial: montantRestant,
          montant_restant: montantRestant,
          statut: 'en_cours',
        })
        .select()
        .single(),
      'insert dette'
    )
    detteId = dette.id
  }

  if (montantPaye > 0) {
    insist(
      await supabase.from('journal_tresorerie').insert({
        magasin_id: magasinId,
        compte_tresorerie_id: comptesTresorerie.caisse,
        type_mouvement: 'sortie',
        montant: montantPaye,
        categorie: 'achat',
        reference_id: achat.id,
        reference_type: 'achat',
        motif: 'Paiement achat',
        utilisateur_id: utilisateurId,
        date_mouvement: dateAchat,
      }),
      'insert journal (achat)'
    )
  }

  return { achatId: achat.id, detteId, montantTotal }
}

async function creerVente({ magasinId, clientId, modePaiement, montantPaye, lignes, utilisateurId, dateVente, comptesTresorerie }) {
  const montantTotal = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
  const vente = insist(
    await supabase
      .from('ventes')
      .insert({
        magasin_id: magasinId,
        client_id: clientId,
        mode_paiement: modePaiement,
        montant_total: montantTotal,
        montant_paye: montantPaye,
        statut: 'validee',
        utilisateur_id: utilisateurId,
        date_vente: dateVente,
      })
      .select()
      .single(),
    'insert vente'
  )

  for (const l of lignes) {
    const achatsArticle = insist(
      await supabase.from('lignes_achat').select('prix_unitaire_achat').eq('article_id', l.articleId).eq('magasin_id', magasinId),
      'select lignes_achat (cout)'
    )
    const coutUnitaire = achatsArticle.length
      ? achatsArticle.reduce((s, a) => s + Number(a.prix_unitaire_achat), 0) / achatsArticle.length
      : 0

    insist(
      await supabase.from('lignes_vente').insert({
        vente_id: vente.id,
        magasin_id: magasinId,
        article_id: l.articleId,
        quantite: l.quantite,
        prix_unitaire: l.prixUnitaire,
        cout_unitaire: coutUnitaire,
      }),
      'insert ligne_vente'
    )
    insist(
      await supabase.from('mouvements_stock').insert({
        magasin_id: magasinId,
        article_id: l.articleId,
        type_mouvement: 'sortie_vente',
        quantite: l.quantite,
        reference_id: vente.id,
        reference_type: 'vente',
        utilisateur_id: utilisateurId,
        created_at: dateVente,
      }),
      'insert mouvement_stock (vente)'
    )
  }

  const montantRestant = montantTotal - montantPaye
  let creanceId = null
  if ((modePaiement === 'credit' || modePaiement === 'mixte') && montantRestant > 0) {
    const creance = insist(
      await supabase
        .from('creances')
        .insert({
          magasin_id: magasinId,
          client_id: clientId,
          vente_id: vente.id,
          montant_initial: montantRestant,
          montant_restant: montantRestant,
          statut: 'en_cours',
        })
        .select()
        .single(),
      'insert creance'
    )
    creanceId = creance.id
  }

  if (montantPaye > 0) {
    insist(
      await supabase.from('journal_tresorerie').insert({
        magasin_id: magasinId,
        compte_tresorerie_id: comptesTresorerie.caisse,
        type_mouvement: 'entree',
        montant: montantPaye,
        categorie: 'vente',
        reference_id: vente.id,
        reference_type: 'vente',
        motif: 'Encaissement vente',
        utilisateur_id: utilisateurId,
        date_mouvement: dateVente,
      }),
      'insert journal (vente)'
    )
  }

  return { venteId: vente.id, creanceId, montantTotal }
}

async function reglerCreance({ creanceId, montant, compteTresorerieId, magasinId, utilisateurId, date }) {
  const creance = insist(await supabase.from('creances').select('montant_restant').eq('id', creanceId).single(), 'select creance')
  const nouveauRestant = Number(creance.montant_restant) - montant
  insist(
    await supabase
      .from('creances')
      .update({ montant_restant: nouveauRestant, statut: nouveauRestant <= 0 ? 'soldee' : 'en_cours' })
      .eq('id', creanceId),
    'update creance'
  )
  insist(
    await supabase.from('journal_tresorerie').insert({
      magasin_id: magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'entree',
      montant,
      categorie: 'reglement_creance',
      reference_id: creanceId,
      reference_type: 'creance',
      motif: 'Règlement créance',
      utilisateur_id: utilisateurId,
      date_mouvement: date,
    }),
    'insert journal (reglement_creance)'
  )
}

async function reglerDette({ detteId, montant, compteTresorerieId, magasinId, utilisateurId, date }) {
  const dette = insist(await supabase.from('dettes').select('montant_restant').eq('id', detteId).single(), 'select dette')
  const nouveauRestant = Number(dette.montant_restant) - montant
  insist(
    await supabase
      .from('dettes')
      .update({ montant_restant: nouveauRestant, statut: nouveauRestant <= 0 ? 'soldee' : 'en_cours' })
      .eq('id', detteId),
    'update dette'
  )
  insist(
    await supabase.from('journal_tresorerie').insert({
      magasin_id: magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'sortie',
      montant,
      categorie: 'reglement_dette',
      reference_id: detteId,
      reference_type: 'dette',
      motif: 'Règlement dette',
      utilisateur_id: utilisateurId,
      date_mouvement: date,
    }),
    'insert journal (reglement_dette)'
  )
}

async function creerUtilisateur({ entrepriseId, email, password, role, magasinId, nom, prenom }) {
  const created = insist(await supabase.auth.admin.createUser({ email, password, email_confirm: true }), 'auth.admin.createUser')
  insist(
    await supabase.from('utilisateurs').insert({
      id: created.user.id,
      entreprise_id: entrepriseId,
      magasin_id: magasinId,
      role,
      nom,
      prenom,
    }),
    'insert utilisateur'
  )
  return created.user.id
}

async function main() {
  console.log('1. Entreprise SUNUQuinca...')
  const abonnementExpireLe = daysAgo(-180)
  const entreprise = insist(
    await supabase
      .from('entreprises')
      .insert({
        nom: 'SUNUQuinca',
        adresse: 'Route de Rufisque, Dakar, Sénégal',
        telephone: '+221 77 123 45 67',
        devise: 'XOF',
        statut: 'actif',
        palier: 'medium',
        abonnement_expire_le: abonnementExpireLe,
      })
      .select()
      .single(),
    'insert entreprise'
  )

  insist(
    await supabase.from('abonnements').insert({
      entreprise_id: entreprise.id,
      palier: 'medium',
      duree_mois: 6,
      montant_fcfa: 42750,
      provider: 'chariow',
      provider_reference: 'demo_seed_sunuquinca',
      statut: 'paye',
      periode_debut: daysAgo(1),
      periode_fin: abonnementExpireLe,
      paye_at: daysAgo(1),
    }),
    'insert abonnement'
  )

  console.log('2. Magasins...')
  const magasin1 = insist(
    await supabase
      .from('magasins')
      .insert({ entreprise_id: entreprise.id, nom: 'SUNUQuinca1', adresse: 'Marché Sandaga, Dakar', telephone: '+221 77 111 22 33' })
      .select()
      .single(),
    'insert magasin1'
  )
  const magasin2 = insist(
    await supabase
      .from('magasins')
      .insert({ entreprise_id: entreprise.id, nom: 'SUNUQuinca2', adresse: 'Avenue Général de Gaulle, Thiès', telephone: '+221 77 444 55 66' })
      .select()
      .single(),
    'insert magasin2'
  )

  console.log('3. Utilisateurs...')
  const motDePasse = 'Demo@2024'
  await creerUtilisateur({ entrepriseId: entreprise.id, email: 'admin@sunuquinca.sn', password: motDePasse, role: 'admin_entreprise', magasinId: null, nom: 'Ndiaye', prenom: 'Abdoulaye' })
  const gerant1Id = await creerUtilisateur({ entrepriseId: entreprise.id, email: 'gerant1@sunuquinca.sn', password: motDePasse, role: 'gerant', magasinId: magasin1.id, nom: 'Diop', prenom: 'Moussa' })
  const gerant2Id = await creerUtilisateur({ entrepriseId: entreprise.id, email: 'gerant2@sunuquinca.sn', password: motDePasse, role: 'gerant', magasinId: magasin2.id, nom: 'Fall', prenom: 'Aïssatou' })

  console.log('4. Catégories & articles...')
  const CATEGORIES = {
    plomberie: 'Plomberie',
    construction: 'Construction & Matériaux',
    metallurgie: 'Quincaillerie & Métallurgie',
    electricite: 'Électricité',
  }
  const catIds = {}
  for (const [key, nom] of Object.entries(CATEGORIES)) {
    const cat = insist(await supabase.from('categories').insert({ entreprise_id: entreprise.id, nom }).select().single(), `insert categorie ${nom}`)
    catIds[key] = cat.id
  }

  // [reference, designation, categorie, unite, prixVente, prixAchat, seuilAlerte, quantiteAchat]
  const ARTICLES = [
    ['PLB-001', 'Tuyau PVC Ø100mm (3m)', 'plomberie', 'barre', 4500, 3200, 10, 40],
    ['PLB-002', 'Tuyau PVC Ø32mm (3m)', 'plomberie', 'barre', 1200, 800, 15, 60],
    ['PLB-003', 'Coude PVC 90° Ø100mm', 'plomberie', 'unite', 800, 500, 20, 80],
    ["PLB-004", "Robinet flotteur chasse d'eau", 'plomberie', 'unite', 3500, 2300, 10, 25],
    ['PLB-005', 'Raccord union PVC Ø100mm', 'plomberie', 'unite', 1000, 650, 15, 50],
    ['PLB-006', 'Mitigeur lavabo', 'plomberie', 'unite', 6000, 4200, 5, 15],
    ['PLB-007', 'Siphon lavabo PVC', 'plomberie', 'unite', 2500, 1600, 10, 30],
    ['CST-001', 'Ciment 50kg', 'construction', 'sac', 4750, 4300, 30, 150],
    ['CST-002', 'Fer à béton HA10 (12m)', 'construction', 'barre', 5200, 4400, 20, 40],
    ['CST-003', 'Fer à béton HA12 (12m)', 'construction', 'barre', 7300, 6200, 20, 35],
    ['CST-004', 'Parpaing creux 15x20x40', 'construction', 'unite', 350, 260, 100, 500],
    ['CST-005', 'Sable de construction', 'construction', 'm3', 8000, 6000, 5, 20],
    ['CST-006', 'Tôle ondulée bac 8/10 (2m)', 'construction', 'feuille', 6500, 5200, 15, 60],
    ['CST-007', 'Chevron bois 6x8 (4m)', 'construction', 'unite', 3200, 2500, 10, 50],
    ['MET-001', 'Fil de fer recuit (1kg)', 'metallurgie', 'rouleau', 1500, 1000, 20, 40],
    ['MET-002', 'Pointe 7cm (kg)', 'metallurgie', 'kg', 1200, 850, 20, 60],
    ['MET-003', 'Cadenas laiton 50mm', 'metallurgie', 'unite', 2000, 1300, 15, 50],
    ['MET-004', 'Charnière métallique 4"', 'metallurgie', 'paire', 1500, 950, 15, 40],
    ['MET-005', 'Serrure de porte 3 points', 'metallurgie', 'unite', 9500, 7000, 8, 20],
    ['MET-006', 'Grillage galvanisé (rouleau 20m)', 'metallurgie', 'rouleau', 15000, 11500, 5, 15],
    ['ELE-001', 'Câble souple 2.5mm² (rouleau 100m)', 'electricite', 'rouleau', 32000, 26000, 5, 15],
    ['ELE-002', 'Disjoncteur 20A', 'electricite', 'unite', 2500, 1700, 15, 60],
    ['ELE-003', 'Ampoule LED 9W', 'electricite', 'unite', 1200, 750, 30, 200],
    ['ELE-004', 'Douille électrique B22', 'electricite', 'unite', 500, 300, 25, 150],
    ['ELE-005', 'Interrupteur simple allumage', 'electricite', 'unite', 800, 500, 20, 100],
    ['ELE-006', 'Prise de courant 2P+T', 'electricite', 'unite', 900, 550, 20, 100],
  ]

  const articles = {}
  for (const [reference, designation, cat, unite, prixVente, prixAchat, seuil, qte] of ARTICLES) {
    const art = insist(
      await supabase
        .from('articles')
        .insert({ entreprise_id: entreprise.id, categorie_id: catIds[cat], reference, designation, unite, prix_vente: prixVente, seuil_alerte: seuil })
        .select()
        .single(),
      `insert article ${reference}`
    )
    articles[reference] = { id: art.id, cat, prixAchat, qte, unite }
  }

  console.log('5. Fournisseurs...')
  const FOURNISSEURS = [
    ['plomberie', 'Sénégal Plomberie Distribution', '+221 33 821 00 01', 'Zone industrielle, Dakar'],
    ['construction', 'Matériaux BTP Sahel', '+221 33 834 12 45', 'Route de Rufisque, Dakar'],
    ['metallurgie', 'Quincaillerie Générale de Dakar', '+221 33 822 55 10', 'Marché Sandaga, Dakar'],
    ['electricite', 'Diallo Matériel Électrique', '+221 77 555 66 77', 'Liberté 6, Dakar'],
  ]
  const fournisseurs = {}
  for (const [cat, nom, telephone, adresse] of FOURNISSEURS) {
    const f = insist(await supabase.from('fournisseurs').insert({ entreprise_id: entreprise.id, nom, telephone, adresse }).select().single(), `insert fournisseur ${nom}`)
    fournisseurs[cat] = f.id
  }

  console.log('6. Clients...')
  const CLIENTS_MAGASIN1 = [
    ['Cheikh Ndiaye', '+221 77 234 56 78', 'Grand Yoff, Dakar'],
    ['Fatou Diop', '+221 78 345 67 89', 'Parcelles Assainies, Dakar'],
    ['Entreprise Sarr & Fils BTP', '+221 33 855 44 22', 'Pikine, Dakar'],
  ]
  const CLIENTS_MAGASIN2 = [
    ['Amadou Ba', '+221 76 456 78 90', 'Thiès Nones'],
    ['Aïssatou Sow BTP', '+221 77 567 89 01', 'Thiès, Route de Dakar'],
    ['Ibrahima Kane', '+221 78 678 90 12', 'Mbour'],
  ]
  const clients1 = {}
  for (const [nom, telephone, adresse] of CLIENTS_MAGASIN1) {
    const c = insist(await supabase.from('clients').insert({ entreprise_id: entreprise.id, magasin_id: magasin1.id, nom, telephone, adresse }).select().single(), `insert client ${nom}`)
    clients1[nom] = c.id
  }
  const clients2 = {}
  for (const [nom, telephone, adresse] of CLIENTS_MAGASIN2) {
    const c = insist(await supabase.from('clients').insert({ entreprise_id: entreprise.id, magasin_id: magasin2.id, nom, telephone, adresse }).select().single(), `insert client ${nom}`)
    clients2[nom] = c.id
  }

  console.log('7. Comptes de trésorerie...')
  async function creerComptes(magasinId, label) {
    const caisse = insist(
      await supabase.from('comptes_tresorerie').insert({ magasin_id: magasinId, nom: `Caisse ${label}`, type_compte: 'caisse', solde_initial: 150000 }).select().single(),
      `insert compte caisse ${label}`
    )
    const mm = insist(
      await supabase.from('comptes_tresorerie').insert({ magasin_id: magasinId, nom: `Mobile Money ${label}`, type_compte: 'mobile_money', solde_initial: 75000 }).select().single(),
      `insert compte mobile money ${label}`
    )
    return { caisse: caisse.id, mobileMoney: mm.id }
  }
  const comptes1 = await creerComptes(magasin1.id, 'SUNUQuinca1')
  const comptes2 = await creerComptes(magasin2.id, 'SUNUQuinca2')

  console.log('8. Achats (stock initial)...')
  const articlesParCategorie = (cat) => Object.entries(articles).filter(([, a]) => a.cat === cat)

  async function achatsMagasin(magasinId, utilisateurId, comptesTresorerie, modes) {
    let jour = 45
    for (const cat of ['plomberie', 'construction', 'metallurgie', 'electricite']) {
      const lignes = articlesParCategorie(cat).map(([, a]) => ({ articleId: a.id, quantite: a.qte, prixUnitaireAchat: a.prixAchat }))
      const montantTotal = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaireAchat, 0)
      const mode = modes[cat]
      const montantPaye = mode === 'comptant' ? montantTotal : mode === 'mixte' ? Math.round(montantTotal * 0.5) : 0
      await creerAchat({
        magasinId,
        fournisseurId: fournisseurs[cat],
        modePaiement: mode,
        montantPaye,
        lignes,
        utilisateurId,
        dateAchat: daysAgo(jour),
        comptesTresorerie,
      })
      jour -= 1
    }
  }

  await achatsMagasin(magasin1.id, gerant1Id, comptes1, { plomberie: 'comptant', construction: 'credit', metallurgie: 'mixte', electricite: 'comptant' })
  await achatsMagasin(magasin2.id, gerant2Id, comptes2, { plomberie: 'mixte', construction: 'credit', metallurgie: 'comptant', electricite: 'comptant' })

  console.log('9. Ventes...')
  const a = (ref) => articles[ref].id

  const ventes1 = [
    { client: 'Cheikh Ndiaye', mode: 'comptant', jour: 25, lignes: [{ articleId: a('PLB-001'), quantite: 3, prixUnitaire: 4500 }, { articleId: a('PLB-003'), quantite: 5, prixUnitaire: 800 }] },
    { client: 'Fatou Diop', mode: 'mixte', jour: 20, lignes: [{ articleId: a('ELE-003'), quantite: 10, prixUnitaire: 1200 }, { articleId: a('ELE-004'), quantite: 10, prixUnitaire: 500 }], paiementPartiel: 10000 },
    { client: 'Entreprise Sarr & Fils BTP', mode: 'credit', jour: 15, lignes: [{ articleId: a('CST-001'), quantite: 20, prixUnitaire: 4750 }, { articleId: a('CST-002'), quantite: 5, prixUnitaire: 5200 }] },
    { client: 'Cheikh Ndiaye', mode: 'comptant', jour: 10, lignes: [{ articleId: a('MET-003'), quantite: 2, prixUnitaire: 2000 }, { articleId: a('MET-004'), quantite: 3, prixUnitaire: 1500 }] },
    { client: 'Fatou Diop', mode: 'comptant', jour: 7, lignes: [{ articleId: a('ELE-002'), quantite: 4, prixUnitaire: 2500 }] },
    { client: 'Entreprise Sarr & Fils BTP', mode: 'mixte', jour: 3, lignes: [{ articleId: a('CST-004'), quantite: 100, prixUnitaire: 350 }, { articleId: a('CST-006'), quantite: 10, prixUnitaire: 6500 }], paiementPartiel: 50000 },
  ]

  const ventes2 = [
    { client: 'Amadou Ba', mode: 'comptant', jour: 25, lignes: [{ articleId: a('PLB-002'), quantite: 10, prixUnitaire: 1200 }, { articleId: a('PLB-005'), quantite: 5, prixUnitaire: 1000 }] },
    { client: 'Aïssatou Sow BTP', mode: 'credit', jour: 20, lignes: [{ articleId: a('CST-001'), quantite: 30, prixUnitaire: 4750 }, { articleId: a('CST-003'), quantite: 8, prixUnitaire: 7300 }] },
    { client: 'Ibrahima Kane', mode: 'mixte', jour: 15, lignes: [{ articleId: a('ELE-001'), quantite: 2, prixUnitaire: 32000 }, { articleId: a('ELE-005'), quantite: 10, prixUnitaire: 800 }], paiementPartiel: 40000 },
    { client: 'Amadou Ba', mode: 'comptant', jour: 10, lignes: [{ articleId: a('MET-001'), quantite: 5, prixUnitaire: 1500 }, { articleId: a('MET-002'), quantite: 8, prixUnitaire: 1200 }] },
    { client: 'Aïssatou Sow BTP', mode: 'comptant', jour: 7, lignes: [{ articleId: a('CST-007'), quantite: 10, prixUnitaire: 3200 }] },
    { client: 'Ibrahima Kane', mode: 'mixte', jour: 3, lignes: [{ articleId: a('PLB-006'), quantite: 2, prixUnitaire: 6000 }, { articleId: a('PLB-007'), quantite: 4, prixUnitaire: 2500 }], paiementPartiel: 12000 },
  ]

  const creances1 = {}
  for (const v of ventes1) {
    const montantTotal = v.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
    const montantPaye = v.mode === 'comptant' ? montantTotal : v.mode === 'mixte' ? v.paiementPartiel : 0
    const { creanceId } = await creerVente({
      magasinId: magasin1.id,
      clientId: clients1[v.client],
      modePaiement: v.mode,
      montantPaye,
      lignes: v.lignes,
      utilisateurId: gerant1Id,
      dateVente: daysAgo(v.jour),
      comptesTresorerie: comptes1,
    })
    if (creanceId) creances1[v.client] = creances1[v.client] || []
    if (creanceId) creances1[v.client].push(creanceId)
  }

  const creances2 = {}
  for (const v of ventes2) {
    const montantTotal = v.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
    const montantPaye = v.mode === 'comptant' ? montantTotal : v.mode === 'mixte' ? v.paiementPartiel : 0
    const { creanceId } = await creerVente({
      magasinId: magasin2.id,
      clientId: clients2[v.client],
      modePaiement: v.mode,
      montantPaye,
      lignes: v.lignes,
      utilisateurId: gerant2Id,
      dateVente: daysAgo(v.jour),
      comptesTresorerie: comptes2,
    })
    if (creanceId) creances2[v.client] = creances2[v.client] || []
    if (creanceId) creances2[v.client].push(creanceId)
  }

  console.log('10. Dettes en cours (pour règlements)...')
  const { data: dettes1 } = await supabase.from('dettes').select('id, montant_restant').eq('magasin_id', magasin1.id)
  const { data: dettes2 } = await supabase.from('dettes').select('id, montant_restant').eq('magasin_id', magasin2.id)

  console.log('11. Règlements (créances & dettes)...')
  // Magasin 1 : solde la créance de Fatou Diop (mixte), règle partiellement celle de Sarr & Fils.
  if (creances1['Fatou Diop']) {
    await reglerCreance({ creanceId: creances1['Fatou Diop'][0], montant: 7000, compteTresorerieId: comptes1.mobileMoney, magasinId: magasin1.id, utilisateurId: gerant1Id, date: daysAgo(8) })
  }
  if (creances1['Entreprise Sarr & Fils BTP']) {
    await reglerCreance({ creanceId: creances1['Entreprise Sarr & Fils BTP'][0], montant: 50000, compteTresorerieId: comptes1.caisse, magasinId: magasin1.id, utilisateurId: gerant1Id, date: daysAgo(5) })
  }
  if (dettes1 && dettes1[0]) {
    await reglerDette({ detteId: dettes1[0].id, montant: Math.min(80000, Number(dettes1[0].montant_restant)), compteTresorerieId: comptes1.caisse, magasinId: magasin1.id, utilisateurId: gerant1Id, date: daysAgo(6) })
  }

  // Magasin 2 : solde la créance d'Ibrahima Kane (mixte), règle partiellement celle d'Aïssatou Sow.
  if (creances2['Ibrahima Kane']) {
    await reglerCreance({ creanceId: creances2['Ibrahima Kane'][0], montant: 32000, compteTresorerieId: comptes2.mobileMoney, magasinId: magasin2.id, utilisateurId: gerant2Id, date: daysAgo(8) })
  }
  if (creances2['Aïssatou Sow BTP']) {
    await reglerCreance({ creanceId: creances2['Aïssatou Sow BTP'][0], montant: 100000, compteTresorerieId: comptes2.caisse, magasinId: magasin2.id, utilisateurId: gerant2Id, date: daysAgo(5) })
  }
  if (dettes2 && dettes2[0]) {
    await reglerDette({ detteId: dettes2[0].id, montant: Math.min(60000, Number(dettes2[0].montant_restant)), compteTresorerieId: comptes2.caisse, magasinId: magasin2.id, utilisateurId: gerant2Id, date: daysAgo(6) })
  }

  console.log('12. Charges...')
  async function creerCharge(magasinId, compteTresorerieId, utilisateurId, categorie, libelle, montant, jour, recurrente) {
    const dateCharge = daysAgo(jour).slice(0, 10)
    insist(
      await supabase.from('charges').insert({ magasin_id: magasinId, compte_tresorerie_id: compteTresorerieId, categorie, libelle, montant, date_charge: dateCharge, recurrente, utilisateur_id: utilisateurId }),
      `insert charge ${libelle}`
    )
    insist(
      await supabase.from('journal_tresorerie').insert({
        magasin_id: magasinId,
        compte_tresorerie_id: compteTresorerieId,
        type_mouvement: 'sortie',
        montant,
        categorie: 'charge',
        motif: libelle,
        utilisateur_id: utilisateurId,
        date_mouvement: daysAgo(jour),
      }),
      `insert journal (charge ${libelle})`
    )
  }

  await creerCharge(magasin1.id, comptes1.caisse, gerant1Id, 'loyer', 'Loyer mensuel boutique', 75000, 28, true)
  await creerCharge(magasin1.id, comptes1.caisse, gerant1Id, 'electricite', 'Facture électricité', 15000, 14, true)
  await creerCharge(magasin1.id, comptes1.caisse, gerant1Id, 'transport', 'Transport marchandises', 12000, 4, false)

  await creerCharge(magasin2.id, comptes2.caisse, gerant2Id, 'loyer', 'Loyer mensuel boutique', 60000, 28, true)
  await creerCharge(magasin2.id, comptes2.caisse, gerant2Id, 'electricite', 'Facture électricité', 12000, 14, true)
  await creerCharge(magasin2.id, comptes2.caisse, gerant2Id, 'transport', 'Transport marchandises', 9000, 4, false)

  console.log('\n✅ Démo SUNUQuinca créée avec succès.')
  console.log(`Entreprise: ${entreprise.id}`)
  console.log(`Magasin SUNUQuinca1: ${magasin1.id}`)
  console.log(`Magasin SUNUQuinca2: ${magasin2.id}`)
  console.log('\nComptes de connexion (mot de passe commun): ' + motDePasse)
  console.log('  admin@sunuquinca.sn      (admin_entreprise, vue consolidée)')
  console.log('  gerant1@sunuquinca.sn    (gérant SUNUQuinca1)')
  console.log('  gerant2@sunuquinca.sn    (gérant SUNUQuinca2)')
}

main().catch((err) => {
  console.error('\n❌ Échec du seed:', err.message)
  process.exit(1)
})
