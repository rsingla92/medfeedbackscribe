-- Allow authenticated users to manage preceptors (add, edit, delete)
-- Preceptors are a shared resource — any authenticated user can manage them.

create policy "Authenticated insert preceptors"
  on preceptors for insert with check (auth.role() = 'authenticated');

create policy "Authenticated update preceptors"
  on preceptors for update using (auth.role() = 'authenticated');

create policy "Authenticated delete preceptors"
  on preceptors for delete using (auth.role() = 'authenticated');
