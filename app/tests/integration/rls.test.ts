/**
 * RLS Policy Integration Tests
 *
 * These tests require a local Supabase stack running with migrations applied.
 * See tests/integration/README.md for setup instructions.
 *
 * Required env vars:
 *   SUPABASE_TEST_URL        — e.g. http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY   — anon/public key from `supabase status`
 *   SUPABASE_TEST_SERVICE_KEY — service_role key from `supabase status`
 *
 * When these env vars are absent, ALL tests skip cleanly.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Environment check — skip gracefully when local Supabase is not running
// ---------------------------------------------------------------------------

const TEST_URL = process.env.SUPABASE_TEST_URL
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY

const hasEnv = Boolean(TEST_URL && ANON_KEY && SERVICE_KEY)

// Top-level describe.skip when env is absent so `bun run test` still passes
const describeOrSkip = hasEnv ? describe : describe.skip

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

interface TestUser {
  id: string
  email: string
  password: string
  jwt: string
}

let userA: TestUser
let userB: TestUser
let serviceClient: SupabaseClient

// Seeded IDs
let preceptorId: string
let rotationId: string
let formTemplateId: string

let sessionAId: string
let sessionBId: string
let recordingAId: string
let recordingBId: string
let assessmentAId: string
let assessmentBId: string
let profileBId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function anonClientFor(jwt: string): SupabaseClient {
  return createClient(TEST_URL!, ANON_KEY!, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
    auth: { persistSession: false },
  })
}

function anonClient(): SupabaseClient {
  return createClient(TEST_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  })
}

async function createTestUser(email: string, password: string): Promise<TestUser> {
  // Create via Admin API (service role)
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create user ${email}: ${error?.message}`)

  // Sign in to get JWT
  const anonSb = anonClient()
  const { data: signIn, error: signInError } = await anonSb.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signIn.session)
    throw new Error(`Failed to sign in as ${email}: ${signInError?.message}`)

  return {
    id: data.user.id,
    email,
    password,
    jwt: signIn.session.access_token,
  }
}

async function deleteTestUser(id: string) {
  await serviceClient.auth.admin.deleteUser(id)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  if (!hasEnv) return

  serviceClient = createClient(TEST_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  })

  const ts = Date.now()
  userA = await createTestUser(`rls-test-a-${ts}@example.com`, 'Password123!')
  userB = await createTestUser(`rls-test-b-${ts}@example.com`, 'Password123!')

  // ----- Seed shared resources (service role) -----

  // Preceptor
  const { data: preceptor } = await serviceClient
    .from('preceptors')
    .insert({ name: 'Dr RLS Test', email: 'rls-preceptor@example.com', specialty: 'FM' })
    .select('id')
    .single()
  preceptorId = preceptor!.id

  // Form template
  const { data: template } = await serviceClient
    .from('form_templates')
    .insert({
      name: 'RLS Test Template',
      program: 'UBC FM',
      extraction_mode: 'single',
      max_outputs: 1,
      fields: { overall_rating: { type: 'scale', min: 1, max: 5 } },
      competency_framework: 'CanMEDS',
    })
    .select('id')
    .single()
  formTemplateId = template!.id

  // Rotation
  const { data: rotation } = await serviceClient
    .from('rotations')
    .insert({ name: 'RLS Test Rotation', program: 'UBC FM' })
    .select('id')
    .single()
  rotationId = rotation!.id

  // ----- Sessions -----

  const { data: sessionA } = await serviceClient
    .from('sessions')
    .insert({
      user_id: userA.id,
      preceptor_id: preceptorId,
      rotation_id: rotationId,
      form_template_id: formTemplateId,
      date: new Date().toISOString().split('T')[0],
      consent_confirmed: true,
    })
    .select('id')
    .single()
  sessionAId = sessionA!.id

  const { data: sessionB } = await serviceClient
    .from('sessions')
    .insert({
      user_id: userB.id,
      preceptor_id: preceptorId,
      rotation_id: rotationId,
      form_template_id: formTemplateId,
      date: new Date().toISOString().split('T')[0],
      consent_confirmed: true,
    })
    .select('id')
    .single()
  sessionBId = sessionB!.id

  // ----- Recordings -----

  const { data: recA } = await serviceClient
    .from('recordings')
    .insert({ session_id: sessionAId, language: 'en' })
    .select('id')
    .single()
  recordingAId = recA!.id

  const { data: recB } = await serviceClient
    .from('recordings')
    .insert({ session_id: sessionBId, language: 'en' })
    .select('id')
    .single()
  recordingBId = recB!.id

  // ----- Assessments -----

  const { data: assA } = await serviceClient
    .from('assessments')
    .insert({
      session_id: sessionAId,
      output_index: 1,
      structured_fields: { overall_rating: 4 },
    })
    .select('id')
    .single()
  assessmentAId = assA!.id

  const { data: assB } = await serviceClient
    .from('assessments')
    .insert({
      session_id: sessionBId,
      output_index: 1,
      structured_fields: { overall_rating: 3 },
    })
    .select('id')
    .single()
  assessmentBId = assB!.id

  // ----- Profiles -----

  await serviceClient
    .from('profiles')
    .insert({ id: userA.id, full_name: 'Resident A', program: 'FM' })

  const { data: profB } = await serviceClient
    .from('profiles')
    .insert({ id: userB.id, full_name: 'Resident B', program: 'FM' })
    .select('id')
    .single()
  profileBId = profB!.id
}, 30000)

afterAll(async () => {
  if (!hasEnv || !serviceClient) return

  // Delete test data (cascade handles child rows)
  if (sessionAId) await serviceClient.from('sessions').delete().eq('id', sessionAId)
  if (sessionBId) await serviceClient.from('sessions').delete().eq('id', sessionBId)
  if (preceptorId) await serviceClient.from('preceptors').delete().eq('id', preceptorId)
  if (formTemplateId) await serviceClient.from('form_templates').delete().eq('id', formTemplateId)
  if (rotationId) await serviceClient.from('rotations').delete().eq('id', rotationId)
  if (userA?.id) {
    await serviceClient.from('profiles').delete().eq('id', userA.id)
    await deleteTestUser(userA.id)
  }
  if (userB?.id) {
    await serviceClient.from('profiles').delete().eq('id', userB.id)
    await deleteTestUser(userB.id)
  }
}, 30000)

// ---------------------------------------------------------------------------
// Sanity check: service role has full access
// ---------------------------------------------------------------------------

describeOrSkip('Service role sanity check', () => {
  it('service role can SELECT all sessions', async () => {
    const { data, error } = await serviceClient
      .from('sessions')
      .select('id')
      .in('id', [sessionAId, sessionBId])
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('service role can SELECT all recordings', async () => {
    const { data, error } = await serviceClient
      .from('recordings')
      .select('id')
      .in('id', [recordingAId, recordingBId])
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('service role can SELECT all assessments', async () => {
    const { data, error } = await serviceClient
      .from('assessments')
      .select('id')
      .in('id', [assessmentAId, assessmentBId])
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('service role can SELECT all profiles', async () => {
    const { data, error } = await serviceClient
      .from('profiles')
      .select('id')
      .in('id', [userA.id, userB.id])
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Anonymous (no JWT) — zero access
// ---------------------------------------------------------------------------

describeOrSkip('Anonymous client — zero access', () => {
  it('anon cannot SELECT sessions', async () => {
    const { data } = await anonClient().from('sessions').select('id')
    expect(data).toHaveLength(0)
  })

  it('anon cannot SELECT recordings', async () => {
    const { data } = await anonClient().from('recordings').select('id')
    expect(data).toHaveLength(0)
  })

  it('anon cannot SELECT assessments', async () => {
    const { data } = await anonClient().from('assessments').select('id')
    expect(data).toHaveLength(0)
  })

  it('anon cannot SELECT pipeline_logs', async () => {
    const { data } = await anonClient().from('pipeline_logs').select('id')
    expect(data).toHaveLength(0)
  })

  it('anon cannot SELECT preceptors', async () => {
    const { data } = await anonClient().from('preceptors').select('id')
    // RLS requires auth.role() = 'authenticated', so anon gets 0 rows
    expect(data).toHaveLength(0)
  })

  it('anon cannot SELECT profiles', async () => {
    const { data } = await anonClient().from('profiles').select('id')
    expect(data).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

describeOrSkip('sessions RLS', () => {
  it('user A can SELECT their own session', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('sessions').select('id').eq('id', sessionAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user A CANNOT SELECT user B session (returns 0 rows)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client.from('sessions').select('id').eq('id', sessionBId)
    expect(data).toHaveLength(0)
  })

  it('user A CAN INSERT a session referencing themselves', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client
      .from('sessions')
      .insert({
        user_id: userA.id,
        preceptor_id: preceptorId,
        form_template_id: formTemplateId,
        date: new Date().toISOString().split('T')[0],
        consent_confirmed: false,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    // Cleanup
    if (data?.id) await serviceClient.from('sessions').delete().eq('id', data.id)
  })

  it('user A CANNOT INSERT a session referencing user B', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('sessions')
      .insert({
        user_id: userB.id,
        preceptor_id: preceptorId,
        form_template_id: formTemplateId,
        date: new Date().toISOString().split('T')[0],
        consent_confirmed: false,
      })
      .select('id')
      .single()
    // RLS WITH CHECK should reject this
    expect(error).not.toBeNull()
  })

  it('user A CAN UPDATE their own session', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('sessions')
      .update({ consent_confirmed: true })
      .eq('id', sessionAId)
    expect(error).toBeNull()
  })

  it('user A CANNOT UPDATE user B session (returns 0 rows updated)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client
      .from('sessions')
      .update({ status: 'exported' })
      .eq('id', sessionBId)
      .select('id')
    // RLS filters the target row — 0 rows updated
    expect(data).toHaveLength(0)
  })

  it('user A CANNOT DELETE user B session (no user DELETE policy)', async () => {
    const client = anonClientFor(userA.jwt)
    await client.from('sessions').delete().eq('id', sessionBId)
    // Verify the row still exists via service role
    const { data: check } = await serviceClient
      .from('sessions')
      .select('id')
      .eq('id', sessionBId)
    expect(check).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// recordings
// ---------------------------------------------------------------------------

describeOrSkip('recordings RLS', () => {
  it('user A can SELECT their own recording', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('recordings').select('id').eq('id', recordingAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user A CANNOT SELECT user B recording (returns 0 rows)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client.from('recordings').select('id').eq('id', recordingBId)
    expect(data).toHaveLength(0)
  })

  it('user A CAN INSERT a recording for their own session', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client
      .from('recordings')
      .insert({ session_id: sessionAId, language: 'fr' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) await serviceClient.from('recordings').delete().eq('id', data.id)
  })

  it('user A CANNOT INSERT a recording for user B session', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('recordings')
      .insert({ session_id: sessionBId, language: 'en' })
      .select('id')
      .single()
    expect(error).not.toBeNull()
  })

  it('user A CAN UPDATE their own recording', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('recordings')
      .update({ duration_seconds: 120 })
      .eq('id', recordingAId)
    expect(error).toBeNull()
  })

  it('user A CANNOT UPDATE user B recording (returns 0 rows updated)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client
      .from('recordings')
      .update({ duration_seconds: 999 })
      .eq('id', recordingBId)
      .select('id')
    expect(data).toHaveLength(0)
  })

  it('user A CANNOT DELETE user B recording (no user DELETE policy)', async () => {
    const client = anonClientFor(userA.jwt)
    await client.from('recordings').delete().eq('id', recordingBId)
    const { data: check } = await serviceClient
      .from('recordings')
      .select('id')
      .eq('id', recordingBId)
    expect(check).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// assessments
// ---------------------------------------------------------------------------

describeOrSkip('assessments RLS', () => {
  it('user A can SELECT their own assessment', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('assessments').select('id').eq('id', assessmentAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user A CANNOT SELECT user B assessment (returns 0 rows)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client.from('assessments').select('id').eq('id', assessmentBId)
    expect(data).toHaveLength(0)
  })

  it('user A CAN INSERT an assessment for their own session', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client
      .from('assessments')
      .insert({
        session_id: sessionAId,
        output_index: 2,
        structured_fields: { overall_rating: 5 },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) await serviceClient.from('assessments').delete().eq('id', data.id)
  })

  it('user A CANNOT INSERT an assessment for user B session', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('assessments')
      .insert({
        session_id: sessionBId,
        output_index: 2,
        structured_fields: { overall_rating: 5 },
      })
      .select('id')
      .single()
    expect(error).not.toBeNull()
  })

  it('user A CAN UPDATE their own assessment', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('assessments')
      .update({ resident_reviewed: true })
      .eq('id', assessmentAId)
    expect(error).toBeNull()
  })

  it('user A CANNOT UPDATE user B assessment (returns 0 rows updated)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client
      .from('assessments')
      .update({ resident_reviewed: true })
      .eq('id', assessmentBId)
      .select('id')
    expect(data).toHaveLength(0)
  })

  it('user A CANNOT DELETE user B assessment (no user DELETE policy)', async () => {
    const client = anonClientFor(userA.jwt)
    await client.from('assessments').delete().eq('id', assessmentBId)
    const { data: check } = await serviceClient
      .from('assessments')
      .select('id')
      .eq('id', assessmentBId)
    expect(check).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// pipeline_logs
// ---------------------------------------------------------------------------

describeOrSkip('pipeline_logs RLS', () => {
  it('user A can SELECT their own pipeline_logs', async () => {
    const { data: log } = await serviceClient
      .from('pipeline_logs')
      .insert({ session_id: sessionAId, step: 'stt', status: 'completed' })
      .select('id')
      .single()
    const logAId = log!.id

    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('pipeline_logs').select('id').eq('id', logAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)

    await serviceClient.from('pipeline_logs').delete().eq('id', logAId)
  })

  it('user A CANNOT SELECT user B pipeline_logs (returns 0 rows)', async () => {
    const { data: log } = await serviceClient
      .from('pipeline_logs')
      .insert({ session_id: sessionBId, step: 'stt', status: 'completed' })
      .select('id')
      .single()
    const logBId = log!.id

    const client = anonClientFor(userA.jwt)
    const { data } = await client.from('pipeline_logs').select('id').eq('id', logBId)
    expect(data).toHaveLength(0)

    await serviceClient.from('pipeline_logs').delete().eq('id', logBId)
  })

  it('user A CAN INSERT a pipeline_log for their own session', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client
      .from('pipeline_logs')
      .insert({ session_id: sessionAId, step: 'phi_regex', status: 'started' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) await serviceClient.from('pipeline_logs').delete().eq('id', data.id)
  })

  it('user A CANNOT INSERT a pipeline_log for user B session', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('pipeline_logs')
      .insert({ session_id: sessionBId, step: 'phi_regex', status: 'started' })
      .select('id')
      .single()
    expect(error).not.toBeNull()
  })

  it('user A CANNOT DELETE user B pipeline_logs (no user DELETE policy)', async () => {
    const { data: log } = await serviceClient
      .from('pipeline_logs')
      .insert({ session_id: sessionBId, step: 'extract', status: 'completed' })
      .select('id')
      .single()
    const logBId = log!.id

    const client = anonClientFor(userA.jwt)
    await client.from('pipeline_logs').delete().eq('id', logBId)
    const { data: check } = await serviceClient
      .from('pipeline_logs')
      .select('id')
      .eq('id', logBId)
    expect(check).toHaveLength(1)

    await serviceClient.from('pipeline_logs').delete().eq('id', logBId)
  })
})

// ---------------------------------------------------------------------------
// preceptors (shared — all authenticated users can read+write)
// ---------------------------------------------------------------------------

describeOrSkip('preceptors RLS', () => {
  it('user A can SELECT all preceptors', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('preceptors').select('id').eq('id', preceptorId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user B can also SELECT all preceptors (shared resource)', async () => {
    const client = anonClientFor(userB.jwt)
    const { data, error } = await client.from('preceptors').select('id').eq('id', preceptorId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user A can INSERT a new preceptor', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client
      .from('preceptors')
      .insert({ name: 'Dr New Preceptor', specialty: 'EM' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) await serviceClient.from('preceptors').delete().eq('id', data.id)
  })

  it('user A can UPDATE a preceptor (shared resource)', async () => {
    const { data: p } = await serviceClient
      .from('preceptors')
      .insert({ name: 'Dr Update Me', specialty: 'FM' })
      .select('id')
      .single()
    const pId = p!.id

    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('preceptors')
      .update({ specialty: 'IM' })
      .eq('id', pId)
    expect(error).toBeNull()

    await serviceClient.from('preceptors').delete().eq('id', pId)
  })

  it('user A can DELETE a preceptor (shared resource)', async () => {
    const { data: p } = await serviceClient
      .from('preceptors')
      .insert({ name: 'Dr Delete Me', specialty: 'FM' })
      .select('id')
      .single()
    const pId = p!.id

    const client = anonClientFor(userA.jwt)
    const { error } = await client.from('preceptors').delete().eq('id', pId)
    expect(error).toBeNull()
  })

  it('anonymous user CANNOT SELECT preceptors', async () => {
    const { data } = await anonClient().from('preceptors').select('id').eq('id', preceptorId)
    expect(data).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// profiles (user_profiles — table is named "profiles" in migration 004)
// ---------------------------------------------------------------------------

describeOrSkip('profiles RLS', () => {
  it('user A can SELECT their own profile', async () => {
    const client = anonClientFor(userA.jwt)
    const { data, error } = await client.from('profiles').select('id').eq('id', userA.id)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('user A CANNOT SELECT user B profile (returns 0 rows)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client.from('profiles').select('id').eq('id', userB.id)
    expect(data).toHaveLength(0)
  })

  it('user A CAN UPDATE their own profile', async () => {
    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('profiles')
      .update({ full_name: 'Resident A Updated' })
      .eq('id', userA.id)
    expect(error).toBeNull()
  })

  it('user A CANNOT UPDATE user B profile (returns 0 rows updated)', async () => {
    const client = anonClientFor(userA.jwt)
    const { data } = await client
      .from('profiles')
      .update({ full_name: 'Hacked Name' })
      .eq('id', userB.id)
      .select('id')
    expect(data).toHaveLength(0)
  })

  it('user A CANNOT DELETE user B profile (no user DELETE policy)', async () => {
    const client = anonClientFor(userA.jwt)
    await client.from('profiles').delete().eq('id', userB.id)
    const { data: check } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', userB.id)
    expect(check).toHaveLength(1)
  })

  it('user A CAN INSERT their own profile row', async () => {
    // Create a fresh user with no profile, then let them insert one
    const ts = Date.now()
    const tmpUser = await createTestUser(`rls-profile-test-${ts}@example.com`, 'Password123!')
    const client = anonClientFor(tmpUser.jwt)
    const { data, error } = await client
      .from('profiles')
      .insert({ id: tmpUser.id, full_name: 'Temp Resident' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBe(tmpUser.id)

    await serviceClient.from('profiles').delete().eq('id', tmpUser.id)
    await deleteTestUser(tmpUser.id)
  })

  it('user A CANNOT INSERT a profile row with user B id', async () => {
    // Temporarily remove B's profile so uniqueness is not the blocking factor
    await serviceClient.from('profiles').delete().eq('id', userB.id)

    const client = anonClientFor(userA.jwt)
    const { error } = await client
      .from('profiles')
      .insert({ id: userB.id, full_name: 'Impersonated' })
      .select('id')
      .single()
    expect(error).not.toBeNull()

    // Re-insert B's profile for afterAll cleanup to succeed gracefully
    await serviceClient
      .from('profiles')
      .insert({ id: userB.id, full_name: 'Resident B', program: 'FM' })
    profileBId = userB.id
  })
})
