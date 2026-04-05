1) Diese Dateien in deinen bestehenden Ordner 'coachapp' kopieren und überschreiben.
2) Danach npm install
3) SQL aus supabase/schema.sql in Supabase ausführen
4) npm run dev
5) Erst normal registrieren
6) Danach Coach setzen:
update public.profiles set role='coach' where email='DEINE-MAIL@EXAMPLE.COM';
