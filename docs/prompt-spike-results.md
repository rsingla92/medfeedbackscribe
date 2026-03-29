# Prompt Spike Results -- T-Res Field Note Extraction

**Date**: 2026-03-29
**Template**: T-Res Field Note
**Model**: claude-sonnet-4-20250514
**Framework**: CanMEDS

## Summary

**5/5 transcripts passed** basic extraction checks.

| Transcript | Outputs | Pass | Key Finding |
|---|---|---|---|
| Brief positive | 1 | Yes | PASS: Correctly produced 1 field note |
| Detailed single encounter | 1 | Yes | PASS: Correctly produced 1 field note |
| Multi-encounter (3 patients) | 3 | Yes | PASS: Correctly produced 3 field notes |
| Vague/unhelpful | 1 | Yes | PASS: Correctly produced 1 field note |
| French feedback | 1 | Yes | PASS: Correctly produced 1 field note |

## Detailed Results

### Brief positive

**Input**: "Yeah you did a good job today. Keep it up."

**Expected**: Should produce 1 field note with mostly 'insufficient detail' fields (low confidence, null values)

**Outputs**: 1

- PASS: Correctly produced 1 field note
- Output 1 - Did well: "Performed well overall during today's activities..."
- Output 1 - Consider: (empty)
- Output 1 - Competency tags: []
- PASS: Low average confidence (0.23) -- appropriate for vague input

<details><summary>Raw output</summary>

```json
[
  {
    "output_index": 1,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": null,
      "coaching_did_well": "Performed well overall during today's activities",
      "coaching_consider": null,
      "skill_dimension": null,
      "priority_topics": null,
      "domain_of_care": null
    },
    "competency_tags": [],
    "narrative_summary": "Brief positive feedback indicating the trainee performed well during the day's activities. No specific skills, encounters, or improvement areas were identified.",
    "coaching_did_well": "Performed well overall during today's activities",
    "coaching_consider": null,
    "confidence": {
      "activity_type": 1,
      "observation_type": 0,
      "coaching_did_well": 0.6,
      "coaching_consider": 0,
      "skill_dimension": 0,
      "priority_topics": 0,
      "domain_of_care": 0
    }
  }
]
```

</details>

---

### Detailed single encounter

**Input**: "Overall you did a good job today. Your history was thorough -- you caught the family history of colon cancer which was important for this patient. Your physical exam technique needs work, especially abdominal palpation -- you were too superficial. Your plan was reasonable but you should have considered imaging earlier. You communicated well with the patient and they seemed comfortable with you."

**Expected**: Should produce 1 field note with clear coaching, domain: Care of Adults, skills: Clinical Reasoning + Communication

**Outputs**: 1

- PASS: Correctly produced 1 field note
- Output 1 - Did well: "Conducted a thorough history taking, successfully identified and documented impo..."
- Output 1 - Consider: "Focus on improving physical examination technique, particularly abdominal palpat..."
- Output 1 - Competency tags: [Medical Expert, Communicator]
- Output 1 - Skill dimensions: ["Clinical Reasoning/Skills","Communication"]
- Output 1 - Domain of care: Care of Adults
- Output 1 - Priority topics: ["Abdominal Pain"]
- PASS: Correctly tagged Clinical Reasoning/Skills
- PASS: Correctly tagged Communication

<details><summary>Raw output</summary>

```json
[
  {
    "output_index": 1,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": "Direct Observation",
      "coaching_did_well": "Conducted a thorough history taking, successfully identified and documented important family history of colon cancer that was relevant to the patient's presentation. Demonstrated effective communication skills with the patient, establishing good rapport and ensuring patient comfort during the encounter.",
      "coaching_consider": "Focus on improving physical examination technique, particularly abdominal palpation which was too superficial and may have missed important clinical findings. Consider incorporating imaging studies earlier in the diagnostic workup when clinically indicated.",
      "skill_dimension": [
        "Clinical Reasoning/Skills",
        "Communication"
      ],
      "priority_topics": [
        "Abdominal Pain"
      ],
      "domain_of_care": "Care of Adults"
    },
    "competency_tags": [
      "Medical Expert",
      "Communicator"
    ],
    "narrative_summary": "Trainee demonstrated strong history-taking skills and patient communication but needs improvement in physical examination technique. Clinical reasoning was sound though diagnostic workup timing could be optimized.",
    "coaching_did_well": "Conducted a thorough history taking, successfully identified and documented important family history of colon cancer that was relevant to the patient's presentation. Demonstrated effective communication skills with the patient, establishing good rapport and ensuring patient comfort during the encounter.",
    "coaching_consider": "Focus on improving physical examination technique, particularly abdominal palpation which was too superficial and may have missed important clinical findings. Consider incorporating imaging studies earlier in the diagnostic workup when clinically indicated.",
    "confidence": {
      "activity_type": 1,
      "observation_type": 0.8,
      "coaching_did_well": 0.9,
      "coaching_consider": 0.9,
      "skill_dimension": 0.85,
      "priority_topics": 0.7,
      "domain_of_care": 0.7
    }
  }
]
```

</details>

---

### Multi-encounter (3 patients)

**Input**: "So today we saw three patients together. The first one, the elderly gentleman with chest pain -- your approach was excellent. You did a thorough cardiac workup, ordered the right tests, and your differential was spot on. Good job there. The second patient, the young woman with anxiety -- I noticed you jumped straight to prescribing rather than exploring the psychosocial context. Take more time with mental health presentations. And the third, the pediatric case -- you were a bit nervous with the toddler but your developmental assessment was actually quite good. You just need more confidence with kids."

**Expected**: Should produce 3 separate field notes, one per patient encounter

**Outputs**: 3

- PASS: Correctly produced 3 field notes
- Output 1 - Did well: "Demonstrated excellent clinical approach with thorough cardiac workup, ordered a..."
- Output 1 - Consider: "Continue applying this systematic approach to cardiac presentations while mainta..."
- Output 1 - Competency tags: [Medical Expert]
- Output 1 - Skill dimensions: ["Clinical Reasoning/Skills"]
- Output 1 - Domain of care: Care of the Elderly
- Output 1 - Priority topics: ["Chest Pain"]
- Output 2 - Did well: "Appropriately recognized the need for treatment intervention in the anxiety pres..."
- Output 2 - Consider: "Take more time to explore the psychosocial context before moving to prescribing...."
- Output 2 - Competency tags: [Medical Expert, Communicator]
- Output 2 - Skill dimensions: ["Clinical Reasoning/Skills","Communication"]
- Output 2 - Domain of care: Mental Health and Addictions Care
- Output 2 - Priority topics: ["Anxiety/Depression","Mental Health"]
- Output 3 - Did well: "Performed a thorough and accurate developmental assessment demonstrating good un..."
- Output 3 - Consider: "Build confidence in pediatric interactions. Practice engaging with young childre..."
- Output 3 - Competency tags: [Medical Expert, Communicator]
- Output 3 - Skill dimensions: ["Clinical Reasoning/Skills","Communication"]
- Output 3 - Domain of care: Care of Children and Adolescents
- Output 3 - Priority topics: ["Child Behaviour","Well Child Visit"]

<details><summary>Raw output</summary>

```json
[
  {
    "output_index": 1,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": "Direct Observation",
      "coaching_did_well": "Demonstrated excellent clinical approach with thorough cardiac workup, ordered appropriate diagnostic tests, and developed a comprehensive and accurate differential diagnosis for the chest pain presentation.",
      "coaching_consider": "Continue applying this systematic approach to cardiac presentations while maintaining thoroughness in clinical assessment and diagnostic reasoning.",
      "skill_dimension": [
        "Clinical Reasoning/Skills"
      ],
      "priority_topics": [
        "Chest Pain"
      ],
      "domain_of_care": "Care of the Elderly"
    },
    "competency_tags": [
      "Medical Expert"
    ],
    "narrative_summary": "Trainee demonstrated excellent clinical skills in evaluating an elderly patient with chest pain, showing strong diagnostic reasoning and appropriate test ordering. The systematic approach and accurate differential diagnosis were particularly noteworthy.",
    "coaching_did_well": "Demonstrated excellent clinical approach with thorough cardiac workup, ordered appropriate diagnostic tests, and developed a comprehensive and accurate differential diagnosis for the chest pain presentation.",
    "coaching_consider": "Continue applying this systematic approach to cardiac presentations while maintaining thoroughness in clinical assessment and diagnostic reasoning.",
    "confidence": {
      "activity_type": 1,
      "observation_type": 1,
      "coaching_did_well": 0.9,
      "coaching_consider": 0.6,
      "skill_dimension": 0.9,
      "priority_topics": 1,
      "domain_of_care": 0.8
    }
  },
  {
    "output_index": 2,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": "Direct Observation",
      "coaching_did_well": "Appropriately recognized the need for treatment intervention in the anxiety presentation.",
      "coaching_consider": "Take more time to explore the psychosocial context before moving to prescribing. Consider comprehensive assessment of underlying factors contributing to anxiety before initiating pharmacological treatment.",
      "skill_dimension": [
        "Clinical Reasoning/Skills",
        "Communication"
      ],
      "priority_topics": [
        "Anxiety/Depression",
        "Mental Health"
      ],
      "domain_of_care": "Mental Health and Addictions Care"
    },
    "competency_tags": [
      "Medical Expert",
      "Communicator"
    ],
    "narrative_summary": "Trainee appropriately identified anxiety requiring treatment but moved too quickly to prescribing without adequate exploration of psychosocial factors. Greater attention to comprehensive mental health assessment is needed.",
    "coaching_did_well": "Appropriately recognized the need for treatment intervention in the anxiety presentation.",
    "coaching_consider": "Take more time to explore the psychosocial context before moving to prescribing. Consider comprehensive assessment of underlying factors contributing to anxiety before initiating pharmacological treatment.",
    "confidence": {
      "activity_type": 1,
      "observation_type": 1,
      "coaching_did_well": 0.7,
      "coaching_consider": 0.9,
      "skill_dimension": 0.8,
      "priority_topics": 0.9,
      "domain_of_care": 0.9
    }
  },
  {
    "output_index": 3,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": "Direct Observation",
      "coaching_did_well": "Performed a thorough and accurate developmental assessment demonstrating good understanding of pediatric developmental milestones and evaluation techniques.",
      "coaching_consider": "Build confidence in pediatric interactions. Practice engaging with young children to develop comfort and rapport-building skills with this age group.",
      "skill_dimension": [
        "Clinical Reasoning/Skills",
        "Communication"
      ],
      "priority_topics": [
        "Child Behaviour",
        "Well Child Visit"
      ],
      "domain_of_care": "Care of Children and Adolescents"
    },
    "competency_tags": [
      "Medical Expert",
      "Communicator"
    ],
    "narrative_summary": "Trainee showed strong clinical skills in pediatric developmental assessment but demonstrated nervousness when interacting with the toddler. The assessment quality was good despite comfort level with pediatric patients needing improvement.",
    "coaching_did_well": "Performed a thorough and accurate developmental assessment demonstrating good understanding of pediatric developmental milestones and evaluation techniques.",
    "coaching_consider": "Build confidence in pediatric interactions. Practice engaging with young children to develop comfort and rapport-building skills with this age group.",
    "confidence": {
      "activity_type": 1,
      "observation_type": 1,
      "coaching_did_well": 0.8,
      "coaching_consider": 0.8,
      "skill_dimension": 0.8,
      "priority_topics": 0.7,
      "domain_of_care": 0.9
    }
  }
]
```

</details>

---

### Vague/unhelpful

**Input**: "Fine. Everything was fine today. See you tomorrow."

**Expected**: Should produce 1 field note with all fields marked insufficient/low confidence

**Outputs**: 1

- PASS: Correctly produced 1 field note
- Output 1 - Did well: (empty)
- Output 1 - Consider: (empty)
- Output 1 - Competency tags: []
- PASS: Low average confidence (0.14) -- appropriate for vague input

<details><summary>Raw output</summary>

```json
[
  {
    "output_index": 1,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": null,
      "coaching_did_well": null,
      "coaching_consider": null,
      "skill_dimension": null,
      "priority_topics": null,
      "domain_of_care": null
    },
    "competency_tags": [],
    "narrative_summary": "Preceptor provided minimal feedback indicating overall performance was satisfactory but offered no specific details about what was observed or areas for improvement.",
    "coaching_did_well": null,
    "coaching_consider": null,
    "confidence": {
      "activity_type": 1,
      "observation_type": 0,
      "coaching_did_well": 0,
      "coaching_consider": 0,
      "skill_dimension": 0,
      "priority_topics": 0,
      "domain_of_care": 0
    }
  }
]
```

</details>

---

### French feedback

**Input**: "Aujourd'hui tu as bien fait avec le patient diabetique. Ton examen physique etait complet, surtout l'examen des pieds. Par contre, tu aurais du verifier la tension arterielle en position debout aussi. Ta communication avec le patient etait excellente, il avait l'air de bien comprendre son plan de traitement."

**Expected**: Should produce 1 field note, correctly identified skills and domain despite French

**Outputs**: 1

- PASS: Correctly produced 1 field note
- Output 1 - Did well: "Conducted a comprehensive physical examination, particularly the foot examinatio..."
- Output 1 - Consider: "Next time, consider checking blood pressure in standing position in addition to ..."
- Output 1 - Competency tags: [Medical Expert, Communicator]
- Output 1 - Skill dimensions: ["Clinical Reasoning/Skills","Communication"]
- Output 1 - Domain of care: Care of Adults
- Output 1 - Priority topics: ["Diabetes"]
- PASS: Domain extracted despite French input
- PASS: Correctly identified Diabetes topic from French

<details><summary>Raw output</summary>

```json
[
  {
    "output_index": 1,
    "structured_fields": {
      "activity_type": "Field Note",
      "observation_type": "Direct Observation",
      "coaching_did_well": "Conducted a comprehensive physical examination, particularly the foot examination which is essential for diabetic patients. Demonstrated excellent communication skills with the patient who clearly understood their treatment plan.",
      "coaching_consider": "Next time, consider checking blood pressure in standing position in addition to seated position to assess for orthostatic hypotension, which is important in diabetic patients.",
      "skill_dimension": [
        "Clinical Reasoning/Skills",
        "Communication"
      ],
      "priority_topics": [
        "Diabetes"
      ],
      "domain_of_care": "Care of Adults"
    },
    "competency_tags": [
      "Medical Expert",
      "Communicator"
    ],
    "narrative_summary": "The trainee demonstrated competent care of a diabetic patient with thorough physical examination skills, particularly appropriate foot assessment, and excellent patient communication. Areas for improvement include more comprehensive vital sign assessment including orthostatic blood pressure measurements.",
    "coaching_did_well": "Conducted a comprehensive physical examination, particularly the foot examination which is essential for diabetic patients. Demonstrated excellent communication skills with the patient who clearly understood their treatment plan.",
    "coaching_consider": "Next time, consider checking blood pressure in standing position in addition to seated position to assess for orthostatic hypotension, which is important in diabetic patients.",
    "confidence": {
      "activity_type": 1,
      "observation_type": 0.9,
      "coaching_did_well": 0.95,
      "coaching_consider": 0.9,
      "skill_dimension": 0.95,
      "priority_topics": 1,
      "domain_of_care": 0.9
    }
  }
]
```

</details>

---

## Observations & Recommendations

### What works well
- (To be filled after reviewing results)

### What needs improvement
- (To be filled after reviewing results)

### Prompt changes to try next
- (To be filled after reviewing results)
