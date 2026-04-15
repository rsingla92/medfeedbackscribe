import { describe, it, expect } from 'vitest'

// ── Static imports (compile-time check, requirement 9) ────────────────────────
import tresFn from '@/lib/templates/ubc-fm-tres-field-note.json'
import one45Fn from '@/lib/templates/one45-daily-eval-em.json'

// Cast to a workable type so we can index fields by key
type FieldDef = Record<string, unknown>
type Template = {
  name: string
  extraction_mode: string
  max_outputs: number
  fields: Record<string, FieldDef>
  competency_framework: string
  [key: string]: unknown
}

const tRes = tresFn as unknown as Template
const one45 = one45Fn as unknown as Template

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return true when the string is valid JSON */
function isValidJson(raw: string): boolean {
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

// ── 1. Both JSON files parse as valid JSON ────────────────────────────────────
describe('JSON validity', () => {
  it('ubc-fm-tres-field-note.json is valid JSON', () => {
    const raw = JSON.stringify(tRes) // round-trip: import already parsed it
    expect(isValidJson(raw)).toBe(true)
  })

  it('one45-daily-eval-em.json is valid JSON', () => {
    const raw = JSON.stringify(one45)
    expect(isValidJson(raw)).toBe(true)
  })
})

// ── 2. Required top-level keys ────────────────────────────────────────────────
describe('top-level schema', () => {
  const templates: [string, Template][] = [
    ['T-Res Field Note', tRes],
    ['One45 Daily Eval EM', one45],
  ]

  it.each(templates)('%s has a non-empty `name`', (_label, t) => {
    expect(typeof t.name).toBe('string')
    expect(t.name.length).toBeGreaterThan(0)
  })

  it.each(templates)('%s has valid `extraction_mode`', (_label, t) => {
    expect(['multi', 'single']).toContain(t.extraction_mode)
  })

  it.each(templates)('%s has `max_outputs` >= 1', (_label, t) => {
    expect(typeof t.max_outputs).toBe('number')
    expect(t.max_outputs).toBeGreaterThanOrEqual(1)
  })

  it.each(templates)('%s has a `fields` object', (_label, t) => {
    expect(typeof t.fields).toBe('object')
    expect(t.fields).not.toBeNull()
    expect(Array.isArray(t.fields)).toBe(false)
  })

  it.each(templates)('%s has a non-empty `competency_framework`', (_label, t) => {
    expect(typeof t.competency_framework).toBe('string')
    expect(t.competency_framework.length).toBeGreaterThan(0)
  })
})

// ── 3. T-Res specific constraints ─────────────────────────────────────────────
describe('T-Res Field Note specific', () => {
  it('has extraction_mode === "multi"', () => {
    expect(tRes.extraction_mode).toBe('multi')
  })

  it('has max_outputs >= 1', () => {
    expect(tRes.max_outputs).toBeGreaterThanOrEqual(1)
  })

  it('has a `skill_dimension` field', () => {
    expect(tRes.fields).toHaveProperty('skill_dimension')
  })

  it('skill_dimension options reference CanMEDS roles', () => {
    const sd = tRes.fields['skill_dimension'] as { options?: string[] }
    expect(Array.isArray(sd.options)).toBe(true)
    const options = sd.options!
    expect(options.length).toBeGreaterThan(0)

    // CanMEDS roles mapped in the template as plain labels
    const canmedsMappings: Record<string, string> = {
      'Clinical Reasoning/Skills': 'Medical Expert',
      'Communication': 'Communicator',
      'Collaboration': 'Collaborator',
      'Leadership/Management': 'Leader',
      'Health Advocacy': 'Health Advocate',
      'Scholarship': 'Scholar',
      'Professionalism': 'Professional',
    }
    // Every option should be one of the recognised CanMEDS-derived labels
    for (const opt of options) {
      expect(Object.keys(canmedsMappings)).toContain(opt)
    }
  })
})

// ── 4. One45 specific constraints ────────────────────────────────────────────
describe('One45 Daily Eval EM specific', () => {
  it('has extraction_mode === "single"', () => {
    expect(one45.extraction_mode).toBe('single')
  })

  it('has max_outputs === 1', () => {
    expect(one45.max_outputs).toBe(1)
  })
})

// ── 5. Every field has a `type` string ───────────────────────────────────────
describe('field `type` presence', () => {
  it('every T-Res field has a type string', () => {
    for (const [key, field] of Object.entries(tRes.fields)) {
      expect(typeof (field as FieldDef).type, `field "${key}" missing type`).toBe('string')
    }
  })

  it('every One45 field has a type string', () => {
    for (const [key, field] of Object.entries(one45.fields)) {
      expect(typeof (field as FieldDef).type, `field "${key}" missing type`).toBe('string')
    }
  })
})

// ── 6. Every `select` / `multi_select` field has a non-empty options array ───
describe('select fields have non-empty options', () => {
  function checkSelectFields(template: Template, templateName: string): void {
    for (const [key, field] of Object.entries(template.fields)) {
      const f = field as FieldDef
      if (f.type === 'select' || f.type === 'multi_select') {
        const opts = f.options as unknown[]
        expect(Array.isArray(opts), `${templateName}.${key} missing options array`).toBe(true)
        expect(opts.length, `${templateName}.${key} options must be non-empty`).toBeGreaterThan(0)
      }
    }
  }

  it('T-Res Field Note select/multi_select fields all have options', () => {
    checkSelectFields(tRes, 'T-Res')
  })

  it('One45 Daily Eval EM select/multi_select fields all have options', () => {
    checkSelectFields(one45, 'One45')
  })
})

// ── 7. Every `scale` field has min < max ─────────────────────────────────────
describe('scale fields have valid min/max', () => {
  function checkScaleFields(template: Template, templateName: string): void {
    for (const [key, field] of Object.entries(template.fields)) {
      const f = field as FieldDef
      if (f.type === 'scale') {
        const min = f.min as number
        const max = f.max as number
        expect(typeof min, `${templateName}.${key} missing min`).toBe('number')
        expect(typeof max, `${templateName}.${key} missing max`).toBe('number')
        expect(min, `${templateName}.${key} min must be < max`).toBeLessThan(max)
      }
    }
  }

  it('T-Res Field Note scale fields have valid min/max (if any)', () => {
    checkScaleFields(tRes, 'T-Res')
  })

  it('One45 Daily Eval EM scale fields have valid min/max (if any)', () => {
    checkScaleFields(one45, 'One45')
  })
})

// ── 8. Mapper / extraction output behaviour (via buildExtractionPrompt) ───────
//
// There is no standalone TS mapper file in app/src/lib/templates/.  The
// mapping from LLM extraction output to template fields is done inside
// `extractAssessment` in app/src/lib/pipeline/extract.ts.  We test the
// normalization logic that function applies to raw LLM output objects.
//
import { buildExtractionPrompt } from '@/lib/pipeline/extract'
import type { AssessmentOutput } from '@/lib/pipeline/extract'

describe('extraction output normalisation', () => {
  // Simulate the normalisation that extractAssessment applies to each element
  // of parsed.outputs (lines 134-144 in extract.ts).
  function normaliseOutput(raw: Record<string, unknown>): AssessmentOutput {
    return {
      output_index: 1,
      structured_fields: (raw.structured_fields as Record<string, unknown>) ?? {},
      competency_tags: (raw.competency_tags as string[]) ?? [],
      narrative_summary: (raw.narrative_summary as string) ?? '',
      coaching_did_well: raw.coaching_did_well as string | undefined,
      coaching_consider: raw.coaching_consider as string | undefined,
      confidence: (raw.confidence as Record<string, number>) ?? {},
    }
  }

  it('happy path -- fully populated output is passed through correctly', () => {
    const raw = {
      structured_fields: { skill_dimension: ['Communication'], coaching_did_well: 'Great history' },
      competency_tags: ['Communicator'],
      narrative_summary: 'Resident demonstrated excellent communication skills.',
      coaching_did_well: 'Clear explanations to patient',
      coaching_consider: 'Document more thoroughly',
      confidence: { skill_dimension: 0.9, coaching_did_well: 0.85 },
    }
    const result = normaliseOutput(raw)
    expect(result.structured_fields).toEqual(raw.structured_fields)
    expect(result.competency_tags).toEqual(['Communicator'])
    expect(result.narrative_summary).toBe(raw.narrative_summary)
    expect(result.coaching_did_well).toBe('Clear explanations to patient')
    expect(result.coaching_consider).toBe('Document more thoroughly')
    expect(result.confidence['skill_dimension']).toBe(0.9)
  })

  it('missing fields -- safe defaults (empty objects/arrays/strings)', () => {
    const raw: Record<string, unknown> = {}
    const result = normaliseOutput(raw)
    expect(result.structured_fields).toEqual({})
    expect(result.competency_tags).toEqual([])
    expect(result.narrative_summary).toBe('')
    expect(result.coaching_did_well).toBeUndefined()
    expect(result.coaching_consider).toBeUndefined()
    expect(result.confidence).toEqual({})
  })

  it('null/undefined optional fields are passed through as undefined', () => {
    const raw: Record<string, unknown> = {
      structured_fields: { rating: null },
      coaching_did_well: undefined,
      coaching_consider: undefined,
    }
    const result = normaliseOutput(raw)
    expect(result.coaching_did_well).toBeUndefined()
    expect(result.coaching_consider).toBeUndefined()
  })

  it('buildExtractionPrompt for T-Res template uses real template field definitions', () => {
    const prompt = buildExtractionPrompt('Resident did great on chest pain workup.', tRes)
    expect(prompt).toContain('T-Res Field Note')
    expect(prompt).toContain('CanMEDS')
    expect(prompt).toContain('skill_dimension')
    expect(prompt).toContain('MULTIPLE distinct activities')
  })

  it('buildExtractionPrompt for One45 template uses real template field definitions', () => {
    const prompt = buildExtractionPrompt('Good shift overall, worked well with nurses.', one45)
    expect(prompt).toContain('One45 Daily Evaluation')
    expect(prompt).toContain('CanMEDS')
    expect(prompt).toContain('medical_expert')
    expect(prompt).toContain('exactly ONE')
  })
})

// ── 9. Both templates importable (compile check already satisfied above) ──────
describe('template import paths', () => {
  it('ubc-fm-tres-field-note is importable and is an object', () => {
    expect(tRes).toBeDefined()
    expect(typeof tRes).toBe('object')
  })

  it('one45-daily-eval-em is importable and is an object', () => {
    expect(one45).toBeDefined()
    expect(typeof one45).toBe('object')
  })
})
