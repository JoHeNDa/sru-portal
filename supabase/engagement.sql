-- Likes, unlikes and comments on articles. Run once in the Supabase SQL Editor.
grant update on article_reactions to authenticated;
grant update (body) on comments to authenticated;

create policy "comments edit own" on comments for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

alter table comments add constraint comment_length check (char_length(body) between 1 and 2000);
