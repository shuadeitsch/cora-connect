-- Adds the "Chanukah visit" email template for every organization (once).
insert into public.outreach_templates (org_id, name, subject, email, sms, sort_order)
select o.id,
  'Chanukah visit',
  $s$A Chanukah visit from Chabad of Maine$s$,
  $b$Hi {first_name}!

With Chanukah coming up, Chabad of Maine is sending yeshiva students to visit Jewish individuals and families across Maine. We'd love to stop by, share some Chanukah joy, and bring along holiday treats or supplies, such as a menorah, donuts, or Chanukah gelt. Whether you could use help lighting the menorah or would simply enjoy a friendly visit, we'd be glad to meet you. Would you be interested in a visit? Just reply to this email, and we'll be in touch to arrange a time that works for you. If you know someone nearby who might enjoy a visit too, feel free to pass this along. Wishing you a bright and happy Chanukah!

Mendel
Chabad of Maine$b$,
  $m$Hi {first_name}, with Chanukah coming up, Chabad of Maine is sending yeshiva students to visit. May we stop by with a menorah and treats? Just reply to arrange a time.$m$,
  5
from public.organizations o
where not exists (
  select 1 from public.outreach_templates existing where existing.org_id = o.id and existing.name = 'Chanukah visit'
);
