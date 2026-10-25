-- Base de référence Niches : schéma Supabase
-- À exécuter une seule fois dans Supabase > SQL Editor > New query.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() n'est pas "immutable", ce qui empêche son usage dans une colonne générée.
create or replace function public.f_unaccent(t text)
returns text
language sql
immutable parallel safe strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

-- Fiches ---------------------------------------------------------------------

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand text not null,
  model text not null,
  new_price numeric(10, 2),
  resale_price numeric(10, 2) not null,
  -- Prix d'achat maximum = prix de revente très bon état / 2,2
  max_buy_price numeric(10, 2) generated always as (round(resale_price / 2.2, 2)) stored,
  material text,
  made_in text,
  gender text check (gender in ('homme', 'femme', 'unisexe')),
  notes text,
  search_text text generated always as (
    lower(public.f_unaccent(
      brand || ' ' || model || ' ' || coalesce(gender, '') || ' ' ||
      coalesce(material, '') || ' ' || coalesce(made_in, '') || ' ' || coalesce(notes, '')
    ))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_search_text_trgm on public.items using gin (search_text extensions.gin_trgm_ops);
create index if not exists items_created_at on public.items (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- Photos (une empreinte visuelle CLIP de 512 dimensions par photo) -------------

create table if not exists public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  position int not null default 0,
  embedding vector(512),
  created_at timestamptz not null default now()
);

create index if not exists item_photos_item on public.item_photos (item_id, position);

-- Sécurité : chaque utilisateur ne voit que ses propres données ---------------

alter table public.items enable row level security;
alter table public.item_photos enable row level security;

drop policy if exists "items_owner" on public.items;
create policy "items_owner" on public.items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "item_photos_owner" on public.item_photos;
create policy "item_photos_owner" on public.item_photos
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Recherche texte : tolérante aux accents et aux fautes de frappe.
-- Chaque mot tapé doit être retrouvé (exactement ou approximativement) dans la fiche.
create or replace function public.search_items_text(q text, max_results int default 40)
returns table (item_id uuid, score real)
language sql stable
set search_path = public, extensions
as $$
  with words as (
    select w
    from unnest(regexp_split_to_array(lower(public.f_unaccent(trim(q))), '\s+')) as w
    where length(w) >= 2
  ),
  scored as (
    select i.id,
           greatest(
             word_similarity(w.w, i.search_text),
             case when position(w.w in i.search_text) > 0 then 1 else 0 end
           ) as s
    from public.items i
    cross join words w
  )
  select id, avg(s)::real
  from scored
  group by id
  having min(s) >= 0.3 and avg(s) >= 0.45
  order by avg(s) desc
  limit max_results
$$;

-- Recherche photo : similarité cosinus entre l'empreinte de la photo cherchée
-- et la meilleure photo de chaque fiche.
create or replace function public.search_items_image(
  query vector(512),
  max_results int default 12,
  min_similarity real default 0.72
)
returns table (item_id uuid, similarity real)
language sql stable
set search_path = public, extensions
as $$
  select p.item_id, max(1 - (p.embedding <=> query))::real as similarity
  from public.item_photos p
  where p.embedding is not null
  group by p.item_id
  having max(1 - (p.embedding <=> query)) >= min_similarity
  order by similarity desc
  limit max_results
$$;

-- Liste des marques déjà saisies (pour l'autocomplétion du formulaire).
create or replace function public.list_brands()
returns table (brand text)
language sql stable
as $$
  select min(brand) from public.items group by lower(trim(brand)) order by 1
$$;

-- Stockage des photos (bucket privé) -------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos_owner_select" on storage.objects;
create policy "photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_owner_insert" on storage.objects;
create policy "photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_owner_delete" on storage.objects;
create policy "photos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
