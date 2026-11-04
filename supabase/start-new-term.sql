-- Starts a new committee term. The open term is closed the day before the new one starts. Admins only.
create or replace function start_new_term(p_start date) returns bigint
language plpgsql security definer set search_path = public as $$
declare cur committee_terms; new_id bigint;
begin
  if not is_admin() then raise exception 'Only admins can start a new term'; end if;
  select * into cur from committee_terms where ends_on is null;
  if found then
    if p_start <= cur.starts_on then
      raise exception 'The new term must start after the current term began (%).', cur.starts_on;
    end if;
    update committee_terms set ends_on = p_start - 1 where id = cur.id;
  end if;
  insert into committee_terms (starts_on) values (p_start) returning id into new_id;
  return new_id;
end $$;
revoke execute on function start_new_term(date) from public, anon;
grant execute on function start_new_term(date) to authenticated;
