import { describe, it, expect } from 'vitest'
import { buildExtractionPrompt } from '../extract.js'

const multiTemplate = {
  name: 'T-Res Field Note',
  extraction_mode: 'multi' as const,
  max_outputs: 5,
  fields: {
    skill_dimension: { type: 'select', options: ['Medical Expert', 'Communicator'] },
    rating: { type: 'scale', min: 1, max: 5 },
    narrative: { type: 'text' },
  },
  competency_framework: 'CanMEDS',
}

const singleTemplate = {
  name: 'One45 Daily Eval',
  extraction_mode: 'single' as const,
  max_outputs: 1,
  fields: {
    overall_rating: { type: 'scale', min: 1, max: 5 },
    comments: { type: 'text' },
  },
  competency_framework: 'CanMEDS',
}

describe('buildExtractionPrompt', () => {
  it('includes max_outputs in multi-mode prompt', () => {
    const prompt = buildExtractionPrompt('Some transcript text', multiTemplate)
    expect(prompt).toContain(`1 and ${multiTemplate.max_outputs}`)
    expect(prompt).toContain('MULTIPLE distinct activities')
  })

  it('says "exactly ONE" in single-mode prompt', () => {
    const prompt = buildExtractionPrompt('Some transcript text', singleTemplate)
    expect(prompt).toContain('exactly ONE')
    expect(prompt).not.toContain('MULTIPLE')
  })

  it('includes template field definitions in the prompt', () => {
    const prompt = buildExtractionPrompt('Some transcript text', multiTemplate)
    expect(prompt).toContain('skill_dimension')
    expect(prompt).toContain('Medical Expert')
    expect(prompt).toContain('Communicator')
    expect(prompt).toContain('narrative')
  })

  it('includes the transcript text in the prompt', () => {
    const transcript = 'The resident did a great job with the intubation'
    const prompt = buildExtractionPrompt(transcript, multiTemplate)
    expect(prompt).toContain(transcript)
  })

  it('includes the form name and competency framework', () => {
    const prompt = buildExtractionPrompt('text', multiTemplate)
    expect(prompt).toContain('T-Res Field Note')
    expect(prompt).toContain('CanMEDS')
  })

  it('includes confidence scoring instructions', () => {
    const prompt = buildExtractionPrompt('text', singleTemplate)
    expect(prompt).toContain('confidence')
    expect(prompt).toContain('0.0-1.0')
  })
})
