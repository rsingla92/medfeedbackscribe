import { describe, it, expect } from 'vitest'
import { regexScrub } from '@/lib/pipeline/phi-scrub'

describe('regexScrub', () => {
  it('redacts MRN patterns like C123-4567', () => {
    const result = regexScrub('Patient MRN is C123-4567 on file')
    expect(result.text).toContain('[MRN]')
    expect(result.text).not.toContain('C123-4567')
    expect(result.redactions).toContainEqual(
      expect.objectContaining({ pattern: '[MRN]', count: 1 })
    )
  })

  it('redacts phone numbers', () => {
    const result = regexScrub('Call me at (416) 555-1234 please')
    expect(result.text).toContain('[PHONE]')
    expect(result.text).not.toContain('555-1234')
  })

  it('redacts phone numbers without parentheses', () => {
    const result = regexScrub('Number is 416-555-1234')
    expect(result.text).toContain('[PHONE]')
    expect(result.text).not.toContain('416-555-1234')
  })

  it('redacts DOB patterns', () => {
    const result = regexScrub('DOB: 12/05/1990 noted in chart')
    expect(result.text).toContain('[DOB]')
    expect(result.text).not.toContain('12/05/1990')
  })

  it('redacts "date of birth" variant', () => {
    const result = regexScrub('date of birth 03-15-1985')
    expect(result.text).toContain('[DOB]')
    expect(result.text).not.toContain('03-15-1985')
  })

  it('passes clean text through unchanged', () => {
    const clean = 'The trainee demonstrated excellent clinical reasoning and communication skills during the encounter.'
    const result = regexScrub(clean)
    expect(result.text).toBe(clean)
    expect(result.redactions).toHaveLength(0)
  })

  it('handles multiple PHI patterns in one transcript', () => {
    const input = 'MRN C123-4567, call (416) 555-1234, DOB: 01/15/1980'
    const result = regexScrub(input)
    expect(result.text).toContain('[MRN]')
    expect(result.text).toContain('[PHONE]')
    expect(result.text).toContain('[DOB]')
    expect(result.text).not.toContain('C123-4567')
    expect(result.text).not.toContain('555-1234')
    expect(result.text).not.toContain('01/15/1980')
    expect(result.redactions.length).toBeGreaterThanOrEqual(3)
  })

  it('redacts email addresses', () => {
    const result = regexScrub('Send results to patient@example.com')
    expect(result.text).toContain('[EMAIL]')
    expect(result.text).not.toContain('patient@example.com')
  })
})
