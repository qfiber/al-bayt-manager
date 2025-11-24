-- Create general_information table
create table public.general_information (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  text_1 text,
  text_2 text,
  text_3 text,
  display_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.general_information enable row level security;

-- All authenticated users can view general information
create policy "Authenticated users can view general information"
on public.general_information
for select
to authenticated
using (true);

-- Only admins can insert general information
create policy "Admins can insert general information"
on public.general_information
for insert
to authenticated
with check (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update general information
create policy "Admins can update general information"
on public.general_information
for update
to authenticated
using (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete general information
create policy "Admins can delete general information"
on public.general_information
for delete
to authenticated
using (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
create trigger update_general_information_updated_at
before update on public.general_information
for each row
execute function public.update_updated_at_column();