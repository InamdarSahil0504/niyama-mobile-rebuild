/**
 * Niyama Life — push notification scheduling.
 *
 * 4 notification types (all defined in config.js NOTIFICATION_TYPES):
 *   morning_wake       — daily at user's wake time (profile.wake_time)
 *   midday_check_in    — daily at 12:00 PM
 *   streak_protection  — daily at 22:00 (10 PM)
 *   gift_card_delivered — one-shot fired immediately after payout
 *
 * Identifiers are persisted in AsyncStorage so they survive app restarts
 * and can be cancelled/rescheduled (e.g., streak_protection after submit).
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_TYPES } from './config';

const IDS_KEY = '@niyama_notif_ids_v1';

// --------------------------------------------------------------------------
// Handler — called whenever a notification should be shown
// --------------------------------------------------------------------------

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// --------------------------------------------------------------------------
// ID persistence
// --------------------------------------------------------------------------

async function getStoredIds() {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setStoredId(key, id) {
  try {
    const ids = await getStoredIds();
    ids[key] = id;
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {}
}

async function removeStoredId(key) {
  try {
    const ids = await getStoredIds();
    delete ids[key];
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {}
}

// --------------------------------------------------------------------------
// Permission check — silent, no UI
// --------------------------------------------------------------------------

async function hasPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// --------------------------------------------------------------------------
// Internal: cancel then schedule a daily repeating notification
// --------------------------------------------------------------------------

async function scheduleDailyRepeating(key, title, body, hour, minute) {
  if (!(await hasPermission())) return;

  // Cancel any existing scheduled notification for this key
  const ids = await getStoredIds();
  if (ids[key]) {
    await Notifications.cancelScheduledNotificationAsync(ids[key]).catch(() => {});
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { hour, minute, repeats: true },
  });

  await setStoredId(key, id);
  return id;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Schedule morning wake notification at the user's wake time.
 * wakeTimeMinutes: integer minutes since midnight from profile.wake_time_minutes
 *   (e.g. 390 = 6:30 AM). Safe to call every time wake_time_minutes changes.
 */
export async function scheduleMorningWake(wakeTimeMinutes) {
  if (wakeTimeMinutes == null) return;
  const hour   = Math.floor(wakeTimeMinutes / 60);
  const minute = wakeTimeMinutes % 60;
  if (isNaN(hour) || isNaN(minute)) return;

  await scheduleDailyRepeating(
    NOTIFICATION_TYPES.morningWake.key,
    NOTIFICATION_TYPES.morningWake.title,
    NOTIFICATION_TYPES.morningWake.body,
    hour,
    minute,
  );
}

/**
 * Schedule midday check-in at 12:00 PM daily.
 * Idempotent — skips if already scheduled with the same key.
 */
export async function scheduleMiddayCheckIn() {
  const ids = await getStoredIds();
  if (ids[NOTIFICATION_TYPES.middayCheckIn.key]) return; // already scheduled

  await scheduleDailyRepeating(
    NOTIFICATION_TYPES.middayCheckIn.key,
    NOTIFICATION_TYPES.middayCheckIn.title,
    NOTIFICATION_TYPES.middayCheckIn.body,
    12,
    0,
  );
}

/**
 * Schedule streak protection at 10:00 PM daily.
 * Idempotent — skips if already scheduled.
 */
export async function scheduleStreakProtection() {
  const ids = await getStoredIds();
  if (ids[NOTIFICATION_TYPES.streakProtection.key]) return;

  await scheduleDailyRepeating(
    NOTIFICATION_TYPES.streakProtection.key,
    NOTIFICATION_TYPES.streakProtection.title,
    NOTIFICATION_TYPES.streakProtection.body,
    22,
    0,
  );
}

/**
 * Cancel today's streak protection after the user submits their day.
 * The next time scheduleStreakProtection() is called (app open tomorrow),
 * a fresh daily trigger is created.
 */
export async function cancelStreakProtectionForToday() {
  const ids = await getStoredIds();
  const id = ids[NOTIFICATION_TYPES.streakProtection.key];
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await removeStoredId(NOTIFICATION_TYPES.streakProtection.key);
}

/**
 * Fire a one-shot notification when an admin sends a support reply.
 * Tapping it navigates to the Contact Us screen via data.screen = 'contact'.
 */
export async function sendSupportReplyNotification() {
  if (!(await hasPermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Niyama Support',
      body: 'You have a new reply from our team.',
      sound: true,
      data: { screen: 'contact' },
    },
    trigger: { seconds: 1 },
  });
}

/**
 * Fire a one-shot gift card notification immediately (1s delay so the
 * payout alert has time to dismiss first).
 */
export async function sendGiftCardNotification() {
  if (!(await hasPermission())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIFICATION_TYPES.giftCardDelivered.title,
      body: NOTIFICATION_TYPES.giftCardDelivered.body,
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}

/**
 * Schedule all recurring notifications.
 * Call this after login when profile.wake_time_minutes is available.
 * wakeTimeMinutes: integer minutes since midnight (e.g. 390 = 6:30 AM)
 */
export async function scheduleAllRecurring(wakeTimeMinutes) {
  await Promise.all([
    scheduleMorningWake(wakeTimeMinutes),
    scheduleMiddayCheckIn(),
    scheduleStreakProtection(),
  ]);
}

/**
 * Cancel all Niyama notifications (used on sign-out).
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  try {
    await AsyncStorage.removeItem(IDS_KEY);
  } catch {}
}
