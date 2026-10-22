create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First account created becomes the admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  display_name text not null default 'Seu Nome',
  handle text not null default 'seunome',
  bio text not null default 'Conteúdo exclusivo, bastidores e comunidade privada para assinantes.',
  avatar_url text,
  cover_url text,
  posts_count int not null default 198,
  media_count int not null default 242,
  locked_count int not null default 78,
  likes_label text not null default '149.8K',
  promo_title text not null default 'Oferta de assinatura',
  promo_text text not null default 'Acesso exclusivo + conteúdos privados + comunidade.',
  promo_original_price numeric(10,2) not null default 50.00,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admin update settings" on public.site_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.site_settings (id) values (1);

create table public.site_private (
  id int primary key default 1 check (id = 1),
  access_link text not null default ''
);
grant select, update on public.site_private to authenticated;
grant all on public.site_private to service_role;
alter table public.site_private enable row level security;
create policy "admin read private" on public.site_private for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin update private" on public.site_private for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.site_private (id, access_link) values (1, 'https://t.me/+TKdIYltmVK04NzEx');

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  price numeric(10,2) not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;
grant all on public.offers to service_role;
alter table public.offers enable row level security;
create policy "public read active offers" on public.offers for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin manage offers" on public.offers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.offers (title, subtitle, price, position) values
 ('Acesso mensal', 'Assinatura principal', 15.99, 0),
 ('3 meses + bônus (50% OFF)', 'Mais escolhido', 21.99, 1),
 ('Acesso vitalício + meu WhatsApp', 'Pagamento único', 31.90, 2);

create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.gallery to anon, authenticated;
grant insert, update, delete on public.gallery to authenticated;
grant all on public.gallery to service_role;
alter table public.gallery enable row level security;
create policy "public read gallery" on public.gallery for select to anon, authenticated using (true);
create policy "admin manage gallery" on public.gallery for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.offers(id) on delete set null,
  offer_title text not null,
  amount numeric(10,2) not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_cpf text not null,
  buyer_phone text not null,
  syncpay_id text,
  pix_code text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "public read media" on storage.objects for select using (bucket_id = 'media');
create policy "admin upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.has_role(auth.uid(),'admin'));
create policy "admin delete media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.has_role(auth.uid(),'admin'));