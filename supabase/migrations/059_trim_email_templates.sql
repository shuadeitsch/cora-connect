-- Keep only "Follow-up thank you" and "Chanukah visit" as saved email templates.
delete from public.outreach_templates
where name in ('Visit announcement', 'Chanukah / holiday visit', 'We''re in the area');
