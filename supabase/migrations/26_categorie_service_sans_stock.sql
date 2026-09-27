-- Une catégorie de services (réparation, livraison, installation…) n'a pas de
-- stock physique : jusqu'ici, tout article générait quand même un mouvement de
-- stock à la vente/à l'achat, et le trigger sync_stock_apres_mouvement (§02)
-- refusait toute sortie qui ferait passer le stock sous zéro — donc vendre un
-- article de service (jamais "acheté", donc toujours à 0 en stock) échouait
-- systématiquement avec "Stock insuffisant". categories.est_service permet au
-- gérant de marquer une catégorie comme dépourvue de stock : les articles qui
-- en dépendent n'engendrent alors plus aucun mouvement, ni à la vente ni à
-- l'achat ni à l'annulation, et disparaissent de l'état des stocks et des
-- alertes de stock bas.

alter table public.categories
  add column est_service boolean not null default false;

comment on column public.categories.est_service is
  'Catégorie sans stock physique (services) : ses articles ne génèrent aucun mouvement dans mouvements_stock et sont exclus de l''état des stocks et des alertes de stock bas.';

-- creer_vente : identique à la version de la migration 18 (annulation_vente_achat),
-- sauf le mouvement de stock désormais conditionné à l'article n'étant pas un service.
create or replace function public.creer_vente(
  p_magasin_id uuid,
  p_client_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_cout_unitaire numeric;
  v_est_service boolean;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une vente doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.ventes (magasin_id, client_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_client_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_vente_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    select coalesce(avg(la.prix_unitaire_achat), 0) into v_cout_unitaire
    from public.lignes_achat la
    join public.achats a on a.id = la.achat_id
    where la.article_id = (v_ligne->>'article_id')::uuid
      and la.magasin_id = p_magasin_id
      and a.statut = 'validee';

    insert into public.lignes_vente (vente_id, magasin_id, article_id, quantite, prix_unitaire, cout_unitaire)
    values (
      v_vente_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire')::numeric, v_cout_unitaire
    );

    select coalesce(cat.est_service, false) into v_est_service
    from public.articles art
    left join public.categories cat on cat.id = art.categorie_id
    where art.id = (v_ligne->>'article_id')::uuid;

    if not v_est_service then
      -- Lève une exception (et annule toute la transaction) si le stock devient négatif.
      insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
      values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'sortie_vente', (v_ligne->>'quantite')::numeric, v_vente_id, 'vente', v_utilisateur_id);
    end if;
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.creances (magasin_id, client_id, vente_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_client_id, v_vente_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'entree', p_montant_paye, 'vente', v_vente_id, 'vente', 'Encaissement vente', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_vente_id;
end;
$$;

-- creer_achat : identique à la version de la migration 10, même traitement.
create or replace function public.creer_achat(
  p_magasin_id uuid,
  p_fournisseur_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb
) returns uuid
language plpgsql as $$
declare
  v_achat_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_est_service boolean;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Un achat doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire_achat')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.achats (magasin_id, fournisseur_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_fournisseur_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_achat_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    insert into public.lignes_achat (achat_id, magasin_id, article_id, quantite, prix_unitaire_achat)
    values (
      v_achat_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire_achat')::numeric
    );

    select coalesce(cat.est_service, false) into v_est_service
    from public.articles art
    left join public.categories cat on cat.id = art.categorie_id
    where art.id = (v_ligne->>'article_id')::uuid;

    if not v_est_service then
      insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
      values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'entree_achat', (v_ligne->>'quantite')::numeric, v_achat_id, 'achat', v_utilisateur_id);
    end if;
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.dettes (magasin_id, fournisseur_id, achat_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_fournisseur_id, v_achat_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'sortie', p_montant_paye, 'achat', v_achat_id, 'achat', 'Paiement achat', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_achat_id;
end;
$$;

-- annuler_vente / annuler_achat : identiques à la version de la migration 19,
-- sauf le mouvement compensatoire désormais sauté pour les articles de service
-- (aucun mouvement d'origine à compenser — en créer un fabriquerait du stock
-- fictif pour un article qui n'en a jamais eu).
create or replace function public.annuler_vente(p_vente_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_creance_id uuid;
  v_creance_initial numeric;
  v_creance_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.ventes where id = p_vente_id;

  if v_magasin_id is null then
    raise exception 'Vente introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cette vente est déjà annulée';
  end if;

  select id, montant_initial, montant_restant into v_creance_id, v_creance_initial, v_creance_restant
  from public.creances where vente_id = p_vente_id;

  if v_creance_id is not null and v_creance_restant <> v_creance_initial then
    raise exception 'Cette créance a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in
    select lv.article_id, lv.quantite, coalesce(cat.est_service, false) as est_service
    from public.lignes_vente lv
    left join public.articles art on art.id = lv.article_id
    left join public.categories cat on cat.id = art.categorie_id
    where lv.vente_id = p_vente_id
  loop
    if not v_ligne.est_service then
      insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
      values (v_magasin_id, v_ligne.article_id, 'ajustement_positif', v_ligne.quantite, p_vente_id, 'annulation_vente', v_utilisateur_id);
    end if;
  end loop;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_creance_id is not null then
    delete from public.creances where id = v_creance_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_vente_id and reference_type = 'vente';

  update public.ventes set statut = 'annulee' where id = p_vente_id;
end;
$$;

create or replace function public.annuler_achat(p_achat_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_dette_id uuid;
  v_dette_initial numeric;
  v_dette_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.achats where id = p_achat_id;

  if v_magasin_id is null then
    raise exception 'Achat introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cet achat est déjà annulé';
  end if;

  select id, montant_initial, montant_restant into v_dette_id, v_dette_initial, v_dette_restant
  from public.dettes where achat_id = p_achat_id;

  if v_dette_id is not null and v_dette_restant <> v_dette_initial then
    raise exception 'Cette dette a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in
    select la.article_id, la.quantite, coalesce(cat.est_service, false) as est_service
    from public.lignes_achat la
    left join public.articles art on art.id = la.article_id
    left join public.categories cat on cat.id = art.categorie_id
    where la.achat_id = p_achat_id
  loop
    if not v_ligne.est_service then
      insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
      values (v_magasin_id, v_ligne.article_id, 'ajustement_negatif', v_ligne.quantite, p_achat_id, 'annulation_achat', v_utilisateur_id);
    end if;
  end loop;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_dette_id is not null then
    delete from public.dettes where id = v_dette_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_achat_id and reference_type = 'achat';

  update public.achats set statut = 'annulee' where id = p_achat_id;
end;
$$;
