-- Dev/demo seed data. Idempotent.
-- Expects a dev user '00000000-0000-0000-0000-000000000001' to exist.

begin;

-- LOCAL DEV ONLY — wipes existing session/recording/assessment rows so the
-- demo seed is idempotent even if the dev user already created sessions by
-- clicking through /record. Do not run this in prod.
delete from pipeline_logs;
delete from assessments;
delete from recordings;
delete from recording_sessions;

-- ── Preceptors (medical TV fictional characters) ─────────────────────────────
-- Clear everyone out (safe now that no session references anything).
delete from preceptors;

insert into preceptors (name, email, specialty, site) values
  -- Grey's Anatomy
  ('Dr. Meredith Grey',      'mgrey@gsm-demo.ca',     'General Surgery',        'Grey Sloan Memorial'),
  ('Dr. Derek Shepherd',     'dshepherd@gsm-demo.ca', 'Neurosurgery',           'Grey Sloan Memorial'),
  ('Dr. Miranda Bailey',     'mbailey@gsm-demo.ca',   'General Surgery',        'Grey Sloan Memorial'),
  ('Dr. Cristina Yang',      'cyang@gsm-demo.ca',     'Cardiothoracic Surgery', 'Grey Sloan Memorial'),
  ('Dr. Mark Sloan',         'msloan@gsm-demo.ca',    'Plastic Surgery',        'Grey Sloan Memorial'),
  ('Dr. Addison Montgomery', 'amontgomery@gsm-demo.ca','Obstetrics and Gynecology','Grey Sloan Memorial'),
  ('Dr. Arizona Robbins',    'arobbins@gsm-demo.ca',  'Pediatrics',             'Grey Sloan Memorial'),
  ('Dr. Jackson Avery',      'javery@gsm-demo.ca',    'Plastic Surgery',        'Grey Sloan Memorial'),

  -- ER (County General)
  ('Dr. Mark Greene',    'mgreene@county-demo.ca',  'Emergency Medicine', 'County General'),
  ('Dr. Doug Ross',      'dross@county-demo.ca',    'Pediatrics',         'County General'),
  ('Dr. John Carter',    'jcarter@county-demo.ca',  'Emergency Medicine', 'County General'),
  ('Dr. Peter Benton',   'pbenton@county-demo.ca',  'General Surgery',    'County General'),
  ('Dr. Abby Lockhart',  'alockhart@county-demo.ca','Emergency Medicine', 'County General'),
  ('Dr. Kerry Weaver',   'kweaver@county-demo.ca',  'Emergency Medicine', 'County General'),

  -- The Pitt
  ('Dr. Michael Robinavitch','mrobby@pitt-demo.ca', 'Emergency Medicine', 'Pittsburgh Trauma Medical Hospital'),
  ('Dr. Heather Collins',    'hcollins@pitt-demo.ca','Emergency Medicine', 'Pittsburgh Trauma Medical Hospital'),
  ('Dr. Frank Langdon',      'flangdon@pitt-demo.ca','Emergency Medicine', 'Pittsburgh Trauma Medical Hospital'),
  ('Dr. Samira Mohan',       'smohan@pitt-demo.ca', 'Emergency Medicine', 'Pittsburgh Trauma Medical Hospital'),
  ('Dr. Trinity Santos',     'tsantos@pitt-demo.ca','Emergency Medicine', 'Pittsburgh Trauma Medical Hospital'),

  -- House MD
  ('Dr. Gregory House',   'ghouse@ptmh-demo.ca',    'Internal Medicine', 'Princeton-Plainsboro'),
  ('Dr. Lisa Cuddy',      'lcuddy@ptmh-demo.ca',    'Endocrinology',     'Princeton-Plainsboro'),
  ('Dr. James Wilson',    'jwilson@ptmh-demo.ca',   'Oncology',          'Princeton-Plainsboro'),
  ('Dr. Allison Cameron', 'acameron@ptmh-demo.ca',  'Internal Medicine', 'Princeton-Plainsboro'),

  -- Scrubs (Sacred Heart)
  ('Dr. Perry Cox',    'pcox@sacred-demo.ca',    'Internal Medicine', 'Sacred Heart'),
  ('Dr. John Dorian',  'jdorian@sacred-demo.ca', 'Internal Medicine', 'Sacred Heart'),
  ('Dr. Christopher Turk','cturk@sacred-demo.ca','General Surgery',   'Sacred Heart'),
  ('Dr. Elliot Reid',  'ereid@sacred-demo.ca',   'Internal Medicine', 'Sacred Heart'),

  -- The Good Doctor
  ('Dr. Shaun Murphy',    'smurphy@sjbh-demo.ca', 'General Surgery', 'St. Bonaventure'),
  ('Dr. Aaron Glassman',  'aglassman@sjbh-demo.ca','Neurosurgery',    'St. Bonaventure'),
  ('Dr. Audrey Lim',      'alim@sjbh-demo.ca',    'Trauma Surgery',  'St. Bonaventure'),

  -- Canadian rep (UBC for flavour)
  ('Dr. Rosalind Chen',   'rchen@ubc-demo.ca',    'Family Medicine', 'UBC FM Vancouver'),
  ('Dr. Sameer Patel',    'spatel@ubc-demo.ca',   'Family Medicine', 'UBC FM Victoria'),
  ('Dr. Marie-Ève Dubois','mdubois@ubc-demo.ca',  'Family Medicine', 'UBC FM Kelowna')
on conflict do nothing;

-- ── Rotations (with specialties so the UI can filter preceptors) ──────────────
delete from rotations;

insert into rotations (name, program, specialty, duration_weeks) values
  ('Family Medicine — Urban Clinic',    'UBC Family Medicine', 'Family Medicine',           4),
  ('Family Medicine — Rural Clinic',    'UBC Family Medicine', 'Family Medicine',           4),
  ('Emergency Medicine',                'UBC Family Medicine', 'Emergency Medicine',        4),
  ('Internal Medicine CTU',             'UBC Family Medicine', 'Internal Medicine',         4),
  ('Pediatrics',                        'UBC Family Medicine', 'Pediatrics',                4),
  ('Obstetrics and Gynecology',         'UBC Family Medicine', 'Obstetrics and Gynecology', 4),
  ('General Surgery',                   'UBC Family Medicine', 'General Surgery',           4),
  ('Palliative Care',                   'UBC Family Medicine', 'Family Medicine',           2),
  ('Geriatrics',                        'UBC Family Medicine', 'Internal Medicine',         2),
  ('Psychiatry',                        'UBC Family Medicine', 'Internal Medicine',         4)
on conflict do nothing;

-- ── Form template rename: T-Res Field Note → UBC FM Coaching Note ────────────
-- Starting July 1, 2026 the Coastal Site moves to One45 + renames Field Notes
-- to Coaching Notes. Keep the rename idempotent.
update form_templates set name = 'UBC FM Coaching Note'
where name in ('UBC FM TRES Field Note', 'T-Res Field Note');

-- ── Demo recording session + assessments for the dev user ────────────────────
-- A ready session the dev user can click into on the home page.
do $$
declare
  v_session_id uuid;
  v_preceptor_id uuid;
  v_rotation_id  uuid;
  v_form_id      uuid;
  v_user         uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- Bail out if the dev user isn't seeded (test envs)
  if not exists (select 1 from users where id = v_user) then
    raise notice 'dev user not present, skipping demo session seed';
    return;
  end if;

  -- Idempotent: skip if a demo session already exists
  if exists (
    select 1 from recording_sessions
    where user_id = v_user and status = 'ready'
      and created_at > now() - interval '365 days'
  ) then
    raise notice 'demo recording_session already exists, skipping';
    return;
  end if;

  select id into v_preceptor_id from preceptors where name = 'Dr. Michael Robinavitch' limit 1;
  select id into v_rotation_id  from rotations  where name = 'Emergency Medicine' limit 1;
  select id into v_form_id      from form_templates limit 1;

  if v_preceptor_id is null or v_form_id is null then
    raise notice 'missing seed data, skipping demo session';
    return;
  end if;

  insert into recording_sessions
    (user_id, preceptor_id, rotation_id, form_template_id, date, consent_confirmed, status)
  values
    (v_user, v_preceptor_id, v_rotation_id, v_form_id, current_date - 1, true, 'ready')
  returning id into v_session_id;

  insert into recordings
    (session_id, audio_path, duration_seconds, transcript_raw, transcript_clean, language, stt_confidence)
  values (
    v_session_id,
    v_user || '/' || v_session_id || '.webm',
    247,
    E'Preceptor: Good shift. Let''s debrief before you go.\n\nResident: Yeah, okay.\n\nPreceptor: Start with the chest pain case — the one in bed 7. Walk me through your thinking from triage.\n\nResident: So he came in with about four hours of substernal chest pain, radiating to the left jaw, associated diaphoresis. ECG was equivocal — maybe some T-wave flattening in the lateral leads but nothing screaming STEMI. Trops were pending.\n\nPreceptor: You pushed for a family history pretty early. Walk me through why.\n\nResident: He mentioned his brother had a heart attack at 52, but I wanted to know about other first-degree relatives. Turned out his father had an MI at 49 and died of a second one at 55. That moves his pretest probability for ACS up a lot — it''s not just chest pain, it''s chest pain with a pretty malignant family history.\n\nPreceptor: And that changed what?\n\nResident: It changed the disposition conversation. I wasn''t going to wait for serial troponins and send him home if one came back negative. I was already in "admit and work this up properly" mode.\n\nPreceptor: Good. That''s exactly the right move and it''s the thing you did best on this case. Most people at your stage take the family history at face value. You went two generations deep and it changed your plan. Keep doing that.\n\nResident: Thanks.\n\nPreceptor: Now — [REDACTED-NAME] in resus bay 2.\n\nResident: Yeah.\n\nPreceptor: Let''s talk about that one.\n\nResident: She came in hypotensive — systolic in the 80s — with a history of a GI bleed two years ago. Nursing had already put in two large bore and was running saline wide open by the time I got there.\n\nPreceptor: And then what did you do?\n\nResident: I took a second pressure to confirm before calling anything.\n\nPreceptor: Right. And that''s what I want to talk about. You had a patient with a GI bleed history, systolic in the 80s, already on wide-open crystalloid, and you waited for a second pressure before escalating. Why?\n\nResident: I guess I was worried about being wrong. I didn''t want to call massive transfusion protocol on a patient who might just be volume down.\n\nPreceptor: I hear that. But think about the math. If you call MTP and the patient turns out to be volume-responsive and you didn''t need the blood — what''s the cost?\n\nResident: Some wasted product. Maybe a conversation with the blood bank.\n\nPreceptor: And if you wait for a confirmatory pressure on someone who''s actively bleeding?\n\nResident: ...time. Could be minutes.\n\nPreceptor: Could be minutes you don''t have. The cost of a false alarm is much lower than the cost of delay in this scenario. On anyone with hypotension plus a clear reason to bleed, escalate first and de-escalate later if the picture changes.\n\nResident: Yeah. That''s fair.\n\nPreceptor: Your communication with the nursing team through the rest of that case was really good, by the way. You were clear, you repeated back orders, you noticed when the RN was swamped and you helped her. That''s not a given at PGY-2.\n\nResident: Thanks.\n\nPreceptor: So — quick summary. Chest pain case: family history gathering and disposition thinking, strong. Hypotension case: escalate earlier next time, don''t wait for a confirmatory pressure. Team communication, excellent across both. Fair summary?\n\nResident: Fair. Thanks for walking through it with me.',
    E'Preceptor: Good shift. Let''s debrief before you go.\n\nResident: Yeah, okay.\n\nPreceptor: Start with the chest pain case. Walk me through your thinking from triage.\n\nResident: So he came in with about four hours of substernal chest pain, radiating to the left jaw, associated diaphoresis. ECG was equivocal — maybe some T-wave flattening in the lateral leads but nothing screaming STEMI. Trops were pending.\n\nPreceptor: You pushed for a family history pretty early. Walk me through why.\n\nResident: He mentioned his brother had a heart attack. I wanted to know about other first-degree relatives. Turned out his father had an MI at 49 and died of a second one at 55. That moves his pretest probability for ACS up a lot — it''s not just chest pain, it''s chest pain with a pretty malignant family history.\n\nPreceptor: And that changed what?\n\nResident: It changed the disposition conversation. I wasn''t going to wait for serial troponins and send him home if one came back negative. I was already in "admit and work this up properly" mode.\n\nPreceptor: Good. That''s exactly the right move and it''s the thing you did best on this case. Most people at your stage take the family history at face value. You went two generations deep and it changed your plan. Keep doing that.\n\nResident: Thanks.\n\nPreceptor: Now — [REDACTED-NAME] in resus bay 2.\n\nResident: Yeah.\n\nPreceptor: Let''s talk about that one.\n\nResident: She came in hypotensive — systolic in the 80s — with a history of a GI bleed two years ago. Nursing had already put in two large bore and was running saline wide open by the time I got there.\n\nPreceptor: And then what did you do?\n\nResident: I took a second pressure to confirm before calling anything.\n\nPreceptor: Right. And that''s what I want to talk about. You had a patient with a GI bleed history, systolic in the 80s, already on wide-open crystalloid, and you waited for a second pressure before escalating. Why?\n\nResident: I guess I was worried about being wrong. I didn''t want to call massive transfusion protocol on a patient who might just be volume down.\n\nPreceptor: I hear that. But think about the math. If you call MTP and the patient turns out to be volume-responsive and you didn''t need the blood — what''s the cost?\n\nResident: Some wasted product. Maybe a conversation with the blood bank.\n\nPreceptor: And if you wait for a confirmatory pressure on someone who''s actively bleeding?\n\nResident: ...time. Could be minutes.\n\nPreceptor: Could be minutes you don''t have. The cost of a false alarm is much lower than the cost of delay in this scenario. On anyone with hypotension plus a clear reason to bleed, escalate first and de-escalate later if the picture changes.\n\nResident: Yeah. That''s fair.\n\nPreceptor: Your communication with the nursing team through the rest of that case was really good. You were clear, you repeated back orders, you noticed when the RN was swamped and you helped her. That''s not a given at PGY-2.\n\nResident: Thanks.\n\nPreceptor: So — quick summary. Chest pain case: family history gathering and disposition thinking, strong. Hypotension case: escalate earlier next time, don''t wait for a confirmatory pressure. Team communication, excellent across both. Fair summary?\n\nResident: Fair. Thanks for walking through it with me.',
    'en',
    0.94
  );

  insert into assessments
    (session_id, output_index, structured_fields, competency_tags, narrative_summary,
     coaching_did_well, coaching_consider, llm_confidence, resident_reviewed, resident_edited)
  values
    (
      v_session_id, 1,
      '{"observation_type":"Direct Observation","skill_dimension":["Clinical Reasoning/Skills","Communication"],"domain_of_care":"Emergency / Urgent","priority_topics":["Chest Pain"]}'::jsonb,
      array['Medical Expert', 'Communicator'],
      'Thorough workup on an undifferentiated chest-pain presentation. Family history gathering changed pretest probability and appropriately altered the workup. Labs and imaging ordered in a timely sequence. Collaboration with nursing was strong.',
      'Caught the family history detail that changed the clinical reasoning. Ordered labs and imaging in the right sequence, no wasted steps. Clear and professional handoff to nursing throughout.',
      null,
      '{"structured_fields":0.91,"narrative_summary":0.88,"competency_tags":0.93}'::jsonb,
      false, false
    ),
    (
      v_session_id, 2,
      '{"observation_type":"Direct Observation","skill_dimension":["Clinical Reasoning/Skills","Leader"],"domain_of_care":"Emergency / Urgent","priority_topics":["Shock","Resuscitation"]}'::jsonb,
      array['Medical Expert', 'Leader'],
      'Managed a hypotensive patient in the resuscitation bay. Hesitated before escalating to massive transfusion protocol, waiting for a confirmatory second pressure. Recovered well once escalation was underway.',
      'Kept the team organized during a complex resus.',
      'Don''t wait for a second pressure before calling massive transfusion protocol on a clearly hypotensive patient. Escalate earlier — the cost of a false alarm is much lower than the cost of delayed product.',
      '{"structured_fields":0.89,"narrative_summary":0.90,"competency_tags":0.87}'::jsonb,
      false, false
    );

  raise notice 'seeded demo session %', v_session_id;
end $$;

commit;
