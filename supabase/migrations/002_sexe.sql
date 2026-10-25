-- Ajoute le sexe (homme / femme / unisexe) aux fiches et l'inclut dans la recherche texte.
-- À exécuter une seule fois dans Supabase > SQL Editor > New query.

alter table public.items
  add column if not exists gender text check (gender in ('homme', 'femme', 'unisexe'));

-- La colonne de recherche est calculée : on la recrée pour y inclure le sexe.
alter table public.items drop column if exists search_text;
alter table public.items add column search_text text generated always as (
  lower(public.f_unaccent(
    brand || ' ' || model || ' ' || coalesce(gender, '') || ' ' ||
    coalesce(material, '') || ' ' || coalesce(made_in, '') || ' ' || coalesce(notes, '')
  ))
) stored;
create index if not exists items_search_text_trgm on public.items using gin (search_text extensions.gin_trgm_ops);
