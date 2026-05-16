/**
 * analytics.js — PostHog + Mixpanel singletons for the mobile app.
 *
 * Both instances are null when the corresponding env var is not set
 * (development without keys, or CI). Every call site uses optional
 * chaining (posthog?.capture / mixpanel?.track) so null is safe.
 *
 * Keys live in .env as EXPO_PUBLIC_* so Metro bakes them in at build time.
 */

import PostHog from 'posthog-react-native';
import { Mixpanel } from 'mixpanel-react-native';

const POSTHOG_KEY    = process.env.EXPO_PUBLIC_POSTHOG_KEY    ?? '';
const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';

// ─── PostHog ─────────────────────────────────────────────────────────────────

let _posthog = null;
if (POSTHOG_KEY) {
  try {
    _posthog = new PostHog(POSTHOG_KEY, {
      host: 'https://us.i.posthog.com',
      enableSessionReplay: false,
    });
  } catch (_) {}
}

/** PostHog client — null when EXPO_PUBLIC_POSTHOG_KEY is not set. */
export const posthog = _posthog;

// ─── Mixpanel ─────────────────────────────────────────────────────────────────

let _mixpanel = null;
if (MIXPANEL_TOKEN) {
  try {
    _mixpanel = new Mixpanel(MIXPANEL_TOKEN, /* trackAutomaticEvents */ false);
    // init() is async but non-blocking; events fired before it resolves
    // are queued internally by the SDK.
    _mixpanel.init().catch(() => {});
  } catch (_) {}
}

/** Mixpanel client — null when EXPO_PUBLIC_MIXPANEL_TOKEN is not set. */
export const mixpanel = _mixpanel;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Identify the logged-in user in both SDKs.
 * Call this immediately after a session is established.
 */
export function identifyUser(userId) {
  try { posthog?.identify(userId); } catch (_) {}
  try { mixpanel?.identify(userId); } catch (_) {}
}

/**
 * Reset both SDK sessions (call on sign-out so the next user
 * doesn't inherit the previous user's identity).
 */
export function resetAnalytics() {
  try { posthog?.reset(); } catch (_) {}
  try { mixpanel?.reset(); } catch (_) {}
}
