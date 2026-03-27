-- MedScribe Pilot Seed Data — UBC Family Medicine

-- Preceptors (from design doc — named rotation leads + pilot cohort)
INSERT INTO preceptors (name, specialty, site) VALUES
  ('Dr. George Chang', 'General Surgery', 'UBC FM'),
  ('Dr. Kevin McLeod', 'Family Medicine', 'UBC FM'),
  ('Dr. Martin Robitaille', 'Family Medicine', 'UBC FM'),
  ('Dr. Iro', 'Family Medicine', 'UBC FM'),
  ('Dr. Naryan', 'Family Medicine', 'UBC FM'),
  ('Dr. Duley', 'Family Medicine', 'UBC FM');

-- Rotations (common UBC FM rotations)
INSERT INTO rotations (name, program, duration_weeks) VALUES
  ('Family Medicine Clinic', 'UBC Family Medicine', 4),
  ('General Surgery', 'UBC Family Medicine', 2),
  ('Emergency Medicine', 'UBC Family Medicine', 4),
  ('Obstetrics & Gynecology', 'UBC Family Medicine', 4),
  ('Psychiatry', 'UBC Family Medicine', 4),
  ('Internal Medicine', 'UBC Family Medicine', 4),
  ('Pediatrics', 'UBC Family Medicine', 4),
  ('Geriatrics', 'UBC Family Medicine', 2),
  ('Palliative Care', 'UBC Family Medicine', 2);

-- Form Templates
INSERT INTO form_templates (name, program, specialty, extraction_mode, max_outputs, fields, competency_framework) VALUES
  (
    'T-Res Field Note',
    'UBC Family Medicine',
    'Family Medicine',
    'multi',
    5,
    '{
      "activity_type": {"type": "select", "label": "Activity Type", "options": ["Field Note"], "default": "Field Note"},
      "observation_type": {"type": "select", "label": "Observation Type", "options": ["Activity Observed", "Direct Observation"]},
      "coaching_did_well": {"type": "text", "label": "Describe something you did well...", "max_length": 2048},
      "coaching_consider": {"type": "text", "label": "Consider (Next time you might...)", "max_length": 2048},
      "skill_dimension": {"type": "multi_select", "label": "Skill Dimension", "options": ["Clinical Reasoning/Skills", "Communication", "Collaboration", "Leadership/Management", "Health Advocacy", "Scholarship", "Professionalism"]},
      "priority_topics": {"type": "multi_select", "label": "Priority Topics", "options": ["Abdominal Pain", "Anxiety/Depression", "Back Pain", "Chest Pain", "Chronic Disease Management", "Contraception/STI", "Cough/Dyspnea", "Dermatology", "Diabetes", "Dizziness", "Drug Prescribing/Interaction", "Fatigue", "Headache", "Hypertension", "Joint Pain", "Mental Health", "Newborn Care", "Pain Management", "Palliative Care", "Pregnancy", "Preventive Care", "Rash", "Substance Abuse", "Urinary Symptoms", "Well Child Visit", "Other"]},
      "domain_of_care": {"type": "select", "label": "Domain of Care", "options": ["Family Medicine Fundamentals", "Health Equity and Care of Community", "Maternity and Newborn Care", "Care of Children and Adolescents", "Care of Adults", "Care of the Elderly", "Palliative and End of Life Care", "Mental Health and Addictions Care", "Surgical and Procedural Skills"]}
    }'::jsonb,
    'CanMEDS'
  ),
  (
    'One45 Daily Evaluation (Emergency Medicine)',
    'UBC Emergency Medicine',
    'Emergency Medicine',
    'single',
    1,
    '{
      "medical_expert": {"type": "rating_group", "label": "Medical Expert", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Clinical Assessments (Hx & Px Investigations)", "Patient Management/Resuscitation Skills", "Procedures", "Judgment/Decision-Making"]},
      "communicator": {"type": "rating_group", "label": "Communication", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Communication with Patients & Families", "Team Work/Conflict Resolution", "Documentation/Teaching"]},
      "collaborator": {"type": "rating_group", "label": "Collaborator", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Team Relationships", "Use of Consultants"]},
      "manager": {"type": "rating_group", "label": "Manager", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Utilization of Resources", "Departmental Management"]},
      "advocate": {"type": "rating_group", "label": "Advocate", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Patients/Profession"]},
      "scholar": {"type": "rating_group", "label": "Scholar", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Basic Sciences", "Evidence-Based Medicine", "Teaching Skills"]},
      "professional": {"type": "rating_group", "label": "Professional", "scale": {"type": "likert_5", "labels": ["Rarely Meets", "Inconsistently Meets", "Generally Meets", "Sometimes Exceeds", "Consistently Exceeds"]}, "items": ["Compassionate Care", "Personal Behaviour"]},
      "strengths": {"type": "text", "label": "Strengths", "max_length": 2048},
      "needs_improvement": {"type": "text", "label": "Needs Improvement", "max_length": 2048}
    }'::jsonb,
    'CanMEDS'
  );
