-- Jalankan setelah schema Extra Fooding lama sudah ada.
-- Fungsi ini memungkinkan leader masuk tanpa Auth, tetapi hanya lewat NIK.
-- Karena extra_fooding.created_by sebelumnya wajib mengarah ke auth.users,
-- kolom tersebut dibuat nullable untuk pencatatan NIK-only.
alter table public.extra_fooding alter column created_by drop not null;

create or replace function public.lookup_employee_by_nik(p_nik text)
returns table(employee_id uuid, nik text, name text, group_id uuid, group_name text)
language plpgsql stable security definer set search_path=public
as $$
declare n integer;
begin
  select count(*) into n from public.employees e join public.work_groups g on g.id=e.work_group_id
  where e.nik=trim(p_nik) and e.active=true and g.active=true;
  if n=0 then return; end if;
  if n>1 then raise exception 'NIK terdaftar lebih dari satu kali. Hubungi Admin untuk memperbaiki data NIK.'; end if;
  return query
  select e.id, e.nik, e.name, g.id, g.name
  from public.employees e join public.work_groups g on g.id=e.work_group_id
  where e.nik=trim(p_nik) and e.active=true and g.active=true;
end;
$$;

grant execute on function public.lookup_employee_by_nik(text) to anon, authenticated;

create or replace function public.get_group_employees_for_nik(p_nik text)
returns table(id uuid, nik text, name text)
language sql stable security definer set search_path=public
as $$
  select e.id,e.nik,e.name
  from public.employees e
  where e.active=true
    and e.work_group_id=(select x.group_id from public.lookup_employee_by_nik(p_nik) x limit 1)
  order by e.name;
$$;
grant execute on function public.get_group_employees_for_nik(text) to anon, authenticated;

create or replace function public.get_open_periods_for_nik(p_nik text)
returns table(id uuid,name text,start_date date,end_date date,status text)
language sql stable security definer set search_path=public
as $$
  if not exists(select 1 from public.lookup_employee_by_nik(p_nik)) then return; end if;
  return query select p.id,p.name,p.start_date,p.end_date,p.status from public.periods p where p.status='open' order by p.start_date desc;
$$;
grant execute on function public.get_open_periods_for_nik(text) to anon, authenticated;

create or replace function public.get_ef_entries_for_nik(p_nik text,p_period_id uuid)
returns table(employee_id uuid,food_date date,shift smallint,status text)
language sql stable security definer set search_path=public
as $$
  select x.employee_id,x.food_date,x.shift,x.status
  from public.extra_fooding x
  join public.employees e on e.id=x.employee_id
  where x.period_id=p_period_id
    and e.work_group_id=(select group_id from public.lookup_employee_by_nik(p_nik) limit 1);
$$;
grant execute on function public.get_ef_entries_for_nik(text,uuid) to anon, authenticated;

create or replace function public.upsert_ef_for_nik(p_nik text,p_period_id uuid,p_employee_id uuid,p_food_date date,p_shift smallint)
returns public.extra_fooding
language plpgsql security definer set search_path=public
as $$
declare r public.extra_fooding; caller public.employees; target public.employees; p public.periods;
begin
  select * into caller from public.employees where nik=trim(p_nik) and active=true limit 1;
  if caller.id is null then raise exception 'NIK tidak terdaftar'; end if;
  select * into target from public.employees where id=p_employee_id and active=true;
  if target.id is null or target.work_group_id<>caller.work_group_id then raise exception 'Karyawan bukan bagian dari kelompok NIK ini'; end if;
  select * into p from public.periods where id=p_period_id and status='open';
  if p.id is null or p_food_date<p.start_date or p_food_date>p.end_date then raise exception 'Periode tidak aktif atau tanggal di luar periode'; end if;
  if p_shift not in (1,2,3) then raise exception 'Shift tidak valid'; end if;
  select * into r from public.extra_fooding where period_id=p_period_id and employee_id=p_employee_id and food_date=p_food_date;
  if r.id is not null and r.status='submitted' then raise exception 'Data sudah submitted dan terkunci'; end if;
  if r.id is null then
    insert into public.extra_fooding(period_id,employee_id,food_date,shift,start_time,end_time,status,created_by)
    values(p_period_id,p_employee_id,p_food_date,p_shift,'00:00','00:00','draft',null) returning * into r;
  else
    update public.extra_fooding set shift=p_shift,status='draft',updated_at=now() where id=r.id returning * into r;
  end if;
  return r;
end;
$$;
grant execute on function public.upsert_ef_for_nik(text,uuid,uuid,date,smallint) to anon, authenticated;

create or replace function public.delete_ef_for_nik(p_nik text,p_period_id uuid,p_employee_id uuid,p_food_date date)
returns boolean language plpgsql security definer set search_path=public
as $$
declare caller public.employees; target public.employees; r public.extra_fooding;
begin
  select * into caller from public.employees where nik=trim(p_nik) and active=true limit 1;
  select * into target from public.employees where id=p_employee_id and active=true;
  if caller.id is null or target.id is null or target.work_group_id<>caller.work_group_id then raise exception 'Akses kelompok tidak valid'; end if;
  select * into r from public.extra_fooding where period_id=p_period_id and employee_id=p_employee_id and food_date=p_food_date;
  if r.status='submitted' then raise exception 'Data sudah submitted dan terkunci'; end if;
  delete from public.extra_fooding where id=r.id;
  return true;
end;
$$;
grant execute on function public.delete_ef_for_nik(text,uuid,uuid,date) to anon, authenticated;

create or replace function public.submit_ef_for_nik(p_nik text,p_period_id uuid)
returns integer language plpgsql security definer set search_path=public
as $$
declare caller public.employees; n integer;
begin
  select * into caller from public.employees where nik=trim(p_nik) and active=true limit 1;
  if caller.id is null then raise exception 'NIK tidak terdaftar'; end if;
  update public.extra_fooding x set status='submitted',submitted_at=now(),updated_at=now()
  where x.period_id=p_period_id and x.status='draft'
    and exists(select 1 from public.employees e where e.id=x.employee_id and e.work_group_id=caller.work_group_id);
  get diagnostics n=row_count;
  return n;
end;
$$;
grant execute on function public.submit_ef_for_nik(text,uuid) to anon, authenticated;
