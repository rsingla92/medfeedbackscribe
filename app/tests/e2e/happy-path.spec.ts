import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/screenshots');

test.describe('Demo happy path', () => {
  test.beforeEach(async ({ page }) => {
    // Stub navigator.mediaDevices.getUserMedia to return a silent fake MediaStream
    // so the recording step works without a real microphone.
    await page.addInitScript(() => {
      // Create a minimal fake MediaStream with one silent audio track.
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      oscillator.connect(dst);
      oscillator.start();
      const fakeStream = dst.stream;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => fakeStream,
          enumerateDevices: async () => [],
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        writable: true,
        configurable: true,
      });

      // Also stub MediaRecorder so it works without real codec support in headless Chrome.
      // Playwright's Chromium does support webm/opus, so this is just a safety net.
      const OriginalMediaRecorder = window.MediaRecorder;
      const supported = OriginalMediaRecorder.isTypeSupported('audio/webm;codecs=opus');
      if (!supported) {
        // Provide a minimal no-op MediaRecorder if the codec is unavailable.
        (window as Window & { MediaRecorder: typeof MediaRecorder }).MediaRecorder = class FakeMediaRecorder extends EventTarget {
          state: RecordingState = 'inactive';
          mimeType = 'audio/webm';
          ondataavailable: ((e: BlobEvent) => void) | null = null;
          onstop: (() => void) | null = null;
          constructor(_stream: MediaStream, _opts?: MediaRecorderOptions) { super(); }
          start() {
            this.state = 'recording';
          }
          stop() {
            this.state = 'inactive';
            if (this.ondataavailable) {
              this.ondataavailable(new BlobEvent('dataavailable', { data: new Blob([], { type: 'audio/webm' }) }));
            }
            if (this.onstop) this.onstop();
          }
          static isTypeSupported(_type: string) { return false; }
        } as unknown as typeof MediaRecorder;
      }
    });
  });

  test('full demo flow: rotation → preceptor → consent → record → review → export', async ({ page }) => {
    // ── Step 1: Navigate to /demo ──
    await page.goto('/demo');
    await expect(page.getByText('Debrief')).toBeVisible();
    await expect(page.getByText('Demo Mode')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-demo-landing.png`, fullPage: true });

    // ── Step 2: Select a rotation ──
    await expect(page.getByText('Select Rotation')).toBeVisible();
    await page.getByRole('button', { name: 'Family Medicine Clinic' }).click();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-pick-preceptor.png`, fullPage: true });

    // ── Step 3: Select a preceptor ──
    await expect(page.getByText('Select Preceptor')).toBeVisible();
    await page.getByRole('button', { name: 'Dr. Sarah Thompson' }).click();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-consent.png`, fullPage: true });

    // ── Step 4: Consent confirmation ──
    await expect(page.getByText('Consent Confirmation')).toBeVisible();
    await expect(page.getByText('Dr. Sarah Thompson')).toBeVisible();
    // "Family Medicine Clinic" should appear in the context badge
    await expect(page.getByText(/Family Medicine Clinic/)).toBeVisible();
    await page.getByRole('button', { name: /Confirm.*Start Recording/i }).click();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-recording-idle.png`, fullPage: true });

    // ── Step 5: Recording screen — tap to start ──
    await expect(page.getByText('Tap to start recording')).toBeVisible();
    // Click the microphone button (circle button on the recording step)
    const micButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await micButton.click();

    // After clicking, the recording UI should show the timer and stop button
    await expect(page.getByRole('button', { name: /Stop Recording/i })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-recording-active.png`, fullPage: true });

    // ── Step 6: Stop the recording ──
    await page.getByRole('button', { name: /Stop Recording/i }).click();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-processing.png`, fullPage: true });

    // ── Step 7: Processing animation ──
    await expect(page.getByText('Processing...')).toBeVisible();
    await expect(page.getByText('Uploading audio...')).toBeVisible();

    // ── Step 8: Review page appears after ~6 s of simulated processing ──
    await expect(page.getByText('Review Assessment')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-review.png`, fullPage: true });

    // Verify transcript section
    await expect(page.getByText('Transcript')).toBeVisible();
    await expect(page.getByText(/Overall you did a good job today/i)).toBeVisible();

    // Verify coaching fields
    await expect(page.getByText('Something you did well')).toBeVisible();
    await expect(page.getByText('Consider next time')).toBeVisible();

    // Verify structured assessment fields
    await expect(page.getByText('Observation Type')).toBeVisible();
    await expect(page.getByText('Direct Observation')).toBeVisible();

    // Verify competency tags
    await expect(page.getByText('Medical Expert')).toBeVisible();
    await expect(page.getByText('Communicator')).toBeVisible();

    // ── Step 9: Export options visible ──
    await expect(page.getByRole('button', { name: /Export as PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-export-options.png`, fullPage: true });

    // ── Step 10: "Start a new session" link is present ──
    await expect(page.getByRole('button', { name: /Start a new session/i })).toBeVisible();
  });
});
