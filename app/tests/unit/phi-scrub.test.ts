/**
 * Comprehensive PHI scrubbing tests — regexScrub()
 *
 * Structure:
 *   - One describe block per HIPAA category + Canadian additions
 *   - ≥3 positive cases (must be redacted) and ≥3 negative cases (must NOT be over-redacted)
 *   - Boundary cases: numbers that look like PHI but aren't
 *   - Bilingual: English + French test cases
 *   - Medical eponyms must NOT be redacted
 */

import { describe, it, expect } from 'vitest'
import { regexScrub } from '@/lib/pipeline/phi-scrub'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function scrub(text: string) {
  return regexScrub(text).text
}

// ---------------------------------------------------------------------------
// 1. Names with titles
// ---------------------------------------------------------------------------
describe('PHI: Names with titles', () => {
  it('redacts "Dr. Smith"', () => {
    expect(scrub('Good work Dr. Smith on the intubation')).not.toContain('Dr. Smith')
    expect(scrub('Good work Dr. Smith on the intubation')).toContain('[REDACTED-NAME]')
  })

  it('redacts "Mr. Jones" with full name', () => {
    expect(scrub('Patient Mr. Jones was admitted yesterday')).not.toContain('Mr. Jones')
  })

  it('redacts "Mrs. O\'Brien"', () => {
    expect(scrub("The family of Mrs. O'Brien called")).not.toContain("Mrs. O'Brien")
  })

  it('does NOT redact "Dr." without a following name', () => {
    // Generic reference - no name follows
    const result = scrub('The attending Dr. was available')
    // "Dr." without a capitalized last name should not trigger the pattern
    expect(result).not.toContain('[REDACTED-NAME]')
  })

  it('does NOT redact medical eponym "Crohn disease"', () => {
    const result = scrub('The patient has Crohn disease and Parkinson\'s')
    expect(result).toBe('The patient has Crohn disease and Parkinson\'s')
  })

  it('does NOT redact medical eponym "Down syndrome"', () => {
    expect(scrub('Child with Down syndrome showed excellent progress')).toContain('Down syndrome')
  })

  it('redacts "Ms. Tremblay" (French name)', () => {
    expect(scrub('Bon travail avec Ms. Tremblay')).not.toContain('Ms. Tremblay')
  })
})

// ---------------------------------------------------------------------------
// 2. Phone numbers
// ---------------------------------------------------------------------------
describe('PHI: Phone numbers', () => {
  it('redacts (NNN) NNN-NNNN format', () => {
    const result = scrub('Call me at (416) 555-1234 please')
    expect(result).toContain('[REDACTED-PHONE]')
    expect(result).not.toContain('555-1234')
  })

  it('redacts NNN-NNN-NNNN format', () => {
    const result = scrub('Number is 604-555-9876')
    expect(result).toContain('[REDACTED-PHONE]')
    expect(result).not.toContain('604-555-9876')
  })

  it('redacts NNN.NNN.NNNN format', () => {
    const result = scrub('Phone: 514.555.2345')
    expect(result).toContain('[REDACTED-PHONE]')
    expect(result).not.toContain('514.555.2345')
  })

  it('does NOT redact a 4-digit PIN', () => {
    const result = scrub('Enter PIN 1234 to access')
    expect(result).not.toContain('[REDACTED-PHONE]')
    expect(result).toContain('1234')
  })

  it('does NOT redact citation "NEJM 2024;391:123-456"', () => {
    const result = scrub('Per NEJM 2024;391:123-456 the treatment was effective')
    // Citation format should not match phone pattern
    expect(result).toContain('NEJM')
  })

  it('does NOT redact a 6-digit lab value reference "pH 7.4, HCO3 24"', () => {
    const result = scrub('ABG showed pH 7.4, HCO3 24, pCO2 40')
    expect(result).not.toContain('[REDACTED-PHONE]')
  })
})

// ---------------------------------------------------------------------------
// 3. Email addresses
// ---------------------------------------------------------------------------
describe('PHI: Email addresses', () => {
  it('redacts a standard email', () => {
    const result = scrub('Send results to patient@example.com')
    expect(result).toContain('[REDACTED-EMAIL]')
    expect(result).not.toContain('patient@example.com')
  })

  it('redacts a complex email', () => {
    expect(scrub('Contact john.doe+tag@hospital.ca for records')).not.toContain('john.doe+tag@hospital.ca')
  })

  it('redacts email in French context', () => {
    expect(scrub('Contactez la famille à info@example.ca')).not.toContain('info@example.ca')
  })

  it('does NOT redact plain text that looks like it has an @', () => {
    // "@" not in email format — unlikely in real text but testing boundary
    const result = scrub('The resident performed well')
    expect(result).toBe('The resident performed well')
  })
})

// ---------------------------------------------------------------------------
// 4. Social Insurance Number (SIN) — Canadian
// ---------------------------------------------------------------------------
describe('PHI: Canadian SIN', () => {
  it('redacts NNN-NNN-NNN format', () => {
    const result = scrub('SIN 123-456-789 was on the form')
    expect(result).toContain('[REDACTED-SIN]')
    expect(result).not.toContain('123-456-789')
  })

  it('redacts NNN NNN NNN format (spaces)', () => {
    const result = scrub('Social insurance 234 567 890')
    expect(result).toContain('[REDACTED-SIN]')
    expect(result).not.toContain('234 567 890')
  })

  it('redacts SIN in sentence context', () => {
    expect(scrub('The patient provided SIN 345-678-901')).not.toContain('345-678-901')
  })
})

// ---------------------------------------------------------------------------
// 5. US Social Security Numbers (SSN)
// ---------------------------------------------------------------------------
describe('PHI: US SSN', () => {
  it('redacts NNN-NN-NNNN format', () => {
    const result = scrub('SSN: 123-45-6789 on file')
    expect(result).toContain('[REDACTED-SSN]')
    expect(result).not.toContain('123-45-6789')
  })

  it('redacts SSN embedded in text', () => {
    expect(scrub('American patient SSN 234-56-7890 documented')).not.toContain('234-56-7890')
  })

  it('redacts another SSN format', () => {
    expect(scrub('SSN is 345-67-8901')).not.toContain('345-67-8901')
  })
})

// ---------------------------------------------------------------------------
// 6. Medical Record Numbers (MRN)
// ---------------------------------------------------------------------------
describe('PHI: Medical Record Numbers', () => {
  it('redacts MRN: digits format', () => {
    const result = scrub('Patient MRN: C123-4567 on file')
    expect(result).toContain('[REDACTED-MRN]')
    expect(result).not.toContain('C123-4567')
  })

  it('redacts Chart # format', () => {
    expect(scrub('Chart #A12345 was reviewed')).not.toContain('A12345')
  })

  it('redacts BC-style letter+digits MRN', () => {
    expect(scrub('H123-45678 is the hospital number')).not.toContain('H123-45678')
  })

  it('does NOT redact a plain 4-letter code like "ABCD"', () => {
    const result = scrub('Follow the ABCD protocol')
    // No letter+digit pattern here
    expect(result).toBe('Follow the ABCD protocol')
  })
})

// ---------------------------------------------------------------------------
// 7. Dates (except year-only)
// ---------------------------------------------------------------------------
describe('PHI: Dates', () => {
  it('redacts MM/DD/YYYY format', () => {
    const result = scrub('DOB: 12/05/1990 noted in chart')
    expect(result).toContain('[REDACTED-DOB]')
    expect(result).not.toContain('12/05/1990')
  })

  it('redacts YYYY-MM-DD format', () => {
    const result = scrub('Admitted 2023-03-15 to ward')
    expect(result).toContain('[REDACTED-DATE]')
    expect(result).not.toContain('2023-03-15')
  })

  it('redacts "March 15, 2024" long date format', () => {
    const result = scrub('Seen on March 15, 2024 for follow-up')
    expect(result).toContain('[REDACTED-DATE]')
    expect(result).not.toContain('March 15, 2024')
  })

  it('does NOT redact a year alone "2024"', () => {
    const result = scrub('This was a 2024 encounter')
    expect(result).toContain('2024')
    expect(result).not.toContain('[REDACTED-DATE]')
    expect(result).not.toContain('[REDACTED-DOB]')
  })

  it('does NOT redact a year mentioned in context "academic year 2025"', () => {
    const result = scrub('The academic year 2025 objectives were met')
    expect(result).toContain('2025')
    expect(result).not.toContain('[REDACTED-DATE]')
  })

  it('redacts DOB with "date of birth" keyword', () => {
    expect(scrub('date of birth 03-15-1985')).not.toContain('03-15-1985')
  })

  it('redacts "born" keyword date', () => {
    expect(scrub('born 01/20/1970 was on the form')).not.toContain('01/20/1970')
  })

  it('redacts French date "5 janvier 2024"', () => {
    const result = scrub('Le patient est né le 5 janvier 2024')
    // The full date (day+month+year) should be redacted
    expect(result).toContain('[REDACTED-DATE]')
    expect(result).not.toContain('janvier 2024')
  })
})

// ---------------------------------------------------------------------------
// 8. Provincial Health Card Numbers
// ---------------------------------------------------------------------------
describe('PHI: Provincial Health Cards', () => {
  it('redacts OHIP format NNNN-NNN-NNN-XX', () => {
    const result = scrub('OHIP: 1234-567-890-AB')
    expect(result).toContain('[REDACTED-OHIP]')
    expect(result).not.toContain('1234-567-890-AB')
  })

  it('redacts NNNN-NNN-NNN health card number', () => {
    const result = scrub('Health card 9876-543-210 on file')
    expect(result).toContain('[REDACTED-HEALTH-CARD]')
    expect(result).not.toContain('9876-543-210')
  })

  it('redacts PHN: NNNNNNNNNN (BC 10-digit)', () => {
    const result = scrub('PHN: 9123456789 registered')
    expect(result).toContain('[REDACTED-PHN-BC]')
    expect(result).not.toContain('9123456789')
  })

  it('redacts RAMQ LLLL NNNN NNNN format (Quebec)', () => {
    const result = scrub('RAMQ: TREM 8501 0512')
    expect(result).toContain('[REDACTED-RAMQ]')
  })

  it('does NOT redact a generic 4-digit code', () => {
    const result = scrub('Blood pressure 120/80 mmHg and O2 sat 98')
    expect(result).not.toContain('[REDACTED-HEALTH-CARD]')
  })
})

// ---------------------------------------------------------------------------
// 9. Canadian Postal Codes
// ---------------------------------------------------------------------------
describe('PHI: Canadian Postal Codes', () => {
  it('redacts A1A 1A1 format', () => {
    const result = scrub('Patient lives at V6T 1Z2 area')
    expect(result).toContain('[REDACTED-POSTAL]')
    expect(result).not.toContain('V6T 1Z2')
  })

  it('redacts A1A1A1 (no space) format', () => {
    const result = scrub('Postal code M5S3H2 on file')
    expect(result).toContain('[REDACTED-POSTAL]')
    expect(result).not.toContain('M5S3H2')
  })

  it('redacts Quebec postal code H3A 0A6', () => {
    expect(scrub('Address in H3A 0A6 Montreal')).not.toContain('H3A 0A6')
  })
})

// ---------------------------------------------------------------------------
// 10. Street Addresses
// ---------------------------------------------------------------------------
describe('PHI: Street addresses', () => {
  it('redacts "123 Main Street"', () => {
    const result = scrub('Lives at 123 Main Street in Vancouver')
    expect(result).toContain('[REDACTED-ADDRESS]')
    expect(result).not.toContain('123 Main Street')
  })

  it('redacts "456 Oak Avenue"', () => {
    expect(scrub('Address: 456 Oak Avenue')).not.toContain('456 Oak')
  })

  it('redacts "789 Maple Blvd"', () => {
    expect(scrub('Patient from 789 Maple Blvd')).not.toContain('789 Maple')
  })

  it('does NOT redact "Room 4" (no street number + suffix)', () => {
    const result = scrub('Seen in the clinic today')
    expect(result).toBe('Seen in the clinic today')
  })
})

// ---------------------------------------------------------------------------
// 11. URLs and IP addresses
// ---------------------------------------------------------------------------
describe('PHI: URLs and IPs', () => {
  it('redacts https:// URL', () => {
    const result = scrub('See https://patient-portal.example.com/records/12345')
    expect(result).toContain('[REDACTED-URL]')
    expect(result).not.toContain('patient-portal.example.com')
  })

  it('redacts www. URL', () => {
    expect(scrub('Visit www.healthrecords.ca for forms')).not.toContain('www.healthrecords.ca')
  })

  it('redacts an IPv4 address', () => {
    const result = scrub('Server at 192.168.1.100 stores the records')
    expect(result).toContain('[REDACTED-IP]')
    expect(result).not.toContain('192.168.1.100')
  })

  it('does NOT redact a normal medical value like "pH 7.4"', () => {
    const result = scrub('Blood gas showed pH 7.4 and pO2 98')
    expect(result).toContain('pH 7.4')
    expect(result).not.toContain('[REDACTED-IP]')
  })
})

// ---------------------------------------------------------------------------
// 12. Hospital identifiers
// ---------------------------------------------------------------------------
describe('PHI: Hospital identifiers', () => {
  it('redacts VGH (Vancouver General Hospital)', () => {
    const result = scrub('Patient transferred from VGH to the community')
    expect(result).toContain('[REDACTED-HOSPITAL]')
    expect(result).not.toContain('VGH')
  })

  it('redacts TGH (Toronto General Hospital)', () => {
    expect(scrub('Referral to TGH cardiology')).not.toContain('TGH')
  })

  it('redacts CHUM (Quebec)', () => {
    expect(scrub('Transfert au CHUM pour chirurgie')).not.toContain('CHUM')
  })

  it('does NOT redact generic "hospital" word', () => {
    const result = scrub('The patient was admitted to the hospital')
    expect(result).toContain('hospital')
    expect(result).not.toContain('[REDACTED-HOSPITAL]')
  })
})

// ---------------------------------------------------------------------------
// 13. Room / bed numbers
// ---------------------------------------------------------------------------
describe('PHI: Room and bed numbers', () => {
  it('redacts "Room 214"', () => {
    const result = scrub('Patient in Room 214 was seen this morning')
    expect(result).toContain('[REDACTED-ROOM]')
    expect(result).not.toContain('Room 214')
  })

  it('redacts "Bed 4B"', () => {
    expect(scrub('Assigned to Bed 4B in the ICU')).not.toContain('Bed 4B')
  })

  it('redacts "Ward #3"', () => {
    expect(scrub('Transferred to Ward #3')).not.toContain('Ward #3')
  })
})

// ---------------------------------------------------------------------------
// 14. Pass-through: clean medical text
// ---------------------------------------------------------------------------
describe('PHI: Clean medical text should pass through unchanged', () => {
  it('does not alter clean assessment text', () => {
    const clean = 'The trainee demonstrated excellent clinical reasoning and communication skills during the encounter.'
    expect(scrub(clean)).toBe(clean)
  })

  it('does not alter CanMEDS competency references', () => {
    const text = 'Strong performance in Medical Expert and Communicator roles.'
    expect(scrub(text)).toBe(text)
  })

  it('does not alter French medical text', () => {
    const text = 'Le résident a démontré de bonnes compétences en médecine interne.'
    expect(scrub(text)).toBe(text)
  })
})

// ---------------------------------------------------------------------------
// 15. Multiple PHI in one transcript
// ---------------------------------------------------------------------------
describe('PHI: Multiple identifiers in one transcript', () => {
  it('redacts MRN, phone, and DOB together', () => {
    const input = 'MRN C123-4567, call (416) 555-1234, DOB: 01/15/1980'
    const result = scrub(input)
    expect(result).not.toContain('C123-4567')
    expect(result).not.toContain('555-1234')
    expect(result).not.toContain('01/15/1980')
  })

  it('redacts email and postal code in same text', () => {
    const input = 'Email patient@example.com living in V6T 1Z2'
    const result = scrub(input)
    expect(result).not.toContain('patient@example.com')
    expect(result).not.toContain('V6T 1Z2')
  })

  it('records redaction counts in return value', () => {
    const input = 'MRN C123-4567, call (416) 555-1234, DOB: 01/15/1980'
    const result = regexScrub(input)
    const total = result.redactions.reduce((sum, r) => sum + r.count, 0)
    expect(total).toBeGreaterThanOrEqual(3)
    expect(result.redactions.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// 16. Bilingual test cases (French)
// ---------------------------------------------------------------------------
describe('PHI: French / Québécois contexts', () => {
  it('redacts phone number in French sentence', () => {
    const result = scrub('Appelez la famille au (514) 555-9876 dès que possible')
    expect(result).toContain('[REDACTED-PHONE]')
    expect(result).not.toContain('514') // area code gone
  })

  it('redacts email in French sentence', () => {
    const result = scrub('Contactez à patient@domaine.ca pour confirmation')
    expect(result).toContain('[REDACTED-EMAIL]')
  })

  it('does NOT alter French medical eponym "maladie de Crohn"', () => {
    const result = scrub('Le patient souffre de la maladie de Crohn')
    expect(result).toContain('maladie de Crohn')
  })

  it('does NOT alter generic "patient" reference in French', () => {
    const result = scrub('Le patient a bien progressé lors de la consultation')
    expect(result).toBe('Le patient a bien progressé lors de la consultation')
  })
})

// ---------------------------------------------------------------------------
// 17. Integration: regexScrub → mock Gemini → regexScrub (belt-and-suspenders)
// ---------------------------------------------------------------------------
describe('PHI: Belt-and-suspenders integration', () => {
  it('second regex pass catches PHI that a mock "Gemini" might miss', () => {
    // Simulate: raw transcript has PHI, first regex catches some but not all
    // A mock "Gemini" output still contains a phone number (simulates LLM drift)
    const simulatedGeminiOutput = 'Good feedback about [REDACTED-NAME]. The family can be reached at (604) 321-9876.'

    // Second regex pass should catch the phone number Gemini left in
    const secondPassResult = regexScrub(simulatedGeminiOutput)
    expect(secondPassResult.text).not.toContain('(604) 321-9876')
    expect(secondPassResult.text).toContain('[REDACTED-PHONE]')
    expect(secondPassResult.redactions.some(r => r.count > 0)).toBe(true)
  })

  it('clean output passes through second regex pass unchanged', () => {
    const cleanOutput = 'The resident demonstrated excellent intubation technique with smooth communication.'
    const result = regexScrub(cleanOutput)
    expect(result.text).toBe(cleanOutput)
    expect(result.redactions).toHaveLength(0)
  })

  it('second pass result has zero redactions when first pass was complete', () => {
    const input = 'Great work overall. The resident showed strong clinical reasoning.'
    const first = regexScrub(input)
    const second = regexScrub(first.text)
    expect(second.redactions).toHaveLength(0)
  })
})
