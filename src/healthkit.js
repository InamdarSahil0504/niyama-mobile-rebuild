// =============================================================================
// Niyama Life — src/healthkit.js
// HealthKit data service using @kingstinct/react-native-healthkit.
// Single export: readHealthMetricsForDate(dateString) → health_metrics row object.
//
// Design principles:
//   • Every query is wrapped in safeQuery() — failures return null, never throw.
//   • All independent queries run in parallel via Promise.all.
//   • Returns all-null object on Android or when HealthKit is unavailable.
//   • Never alert the user, never block the UI.
// =============================================================================

import { Platform } from 'react-native';

// iOS-only, EAS Build only — silent no-op on Android / Expo Go
let Core = null;
if (Platform.OS === 'ios') {
  try {
    Core = require('@kingstinct/react-native-healthkit').default;
  } catch {
    // unavailable in Expo Go / simulators without native build
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Midnight (00:00:00.000) on a YYYY-MM-DD string in local time. */
function startOfDay(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 23:59:59.999 on a YYYY-MM-DD string in local time. */
function endOfDay(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// ─── Query helpers ─────────────────────────────────────────────────────────────

/** Wraps any async HealthKit query — returns null on any error. */
async function safeQuery(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Cumulative sum for a quantity type over [from, to].
 * Unit is whatever HK returns as the preferred unit for that type.
 */
async function daySum(type, from, to) {
  return safeQuery(async () => {
    const r = await Core.queryStatisticsForQuantity(type, { from, to }, ['cumulativeSum']);
    const v = r?.sumQuantity?.quantity ?? r?.sumQuantity?.value;
    return typeof v === 'number' ? v : null;
  });
}

/**
 * Discrete average for a quantity type over [from, to].
 */
async function dayAvg(type, from, to) {
  return safeQuery(async () => {
    const r = await Core.queryStatisticsForQuantity(type, { from, to }, ['discreteAverage']);
    const v = r?.averageQuantity?.quantity ?? r?.averageQuantity?.value;
    return typeof v === 'number' ? v : null;
  });
}

/**
 * Most recent sample value for a quantity type.
 * Falls back to queryStatisticsForQuantity mostRecentQuantity if samples are empty.
 */
async function latestSample(type, from, to) {
  return safeQuery(async () => {
    const samples = await Core.queryQuantitySamples(type, {
      from,
      to,
      limit: 1,
      ascending: false,
    });
    const v = samples?.[0]?.quantity;
    return typeof v === 'number' ? v : null;
  });
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Reads all HealthKit data for the given date and returns an object
 * whose keys match the Supabase `health_metrics` table columns.
 *
 * @param {string} date  YYYY-MM-DD string in local time
 * @returns {Promise<Object>}  Always resolves — nulls for unavailable fields
 */
export async function readHealthMetricsForDate(date) {
  if (Platform.OS !== 'ios' || !Core) {
    return buildNullMetrics(date);
  }

  const from = startOfDay(date);
  const to   = endOfDay(date);

  // Sleep window: 14:00 the day before → 14:00 on the target date.
  // Covers late sleepers and naps without double-counting.
  const sleepFrom = new Date(from.getTime() - 10 * 60 * 60 * 1000); // midnight - 10 h = 14:00 prev day
  const sleepTo   = new Date(from.getTime() + 14 * 60 * 60 * 1000); // midnight + 14 h = 14:00 same day

  // Morning activity window: 06:00–10:00 on the target date
  const morningFrom = new Date(from); morningFrom.setHours(6,  0, 0, 0);
  const morningTo   = new Date(from); morningTo.setHours(10, 0, 0, 0);

  // ── All queries in parallel ─────────────────────────────────────────────────
  const [
    steps,
    distanceMeters,
    activeEnergyKcal,
    basalEnergyKcal,
    exerciseMinutes,
    standTimeMinutes,
    heartRateAvg,
    restingHeartRate,
    hrv,
    vo2Max,
    respiratoryRate,
    rawSpo2,
    daylightMinutes,
    uvExposure,
    morningSteps,
    sleepSamples,
    standSamples,
    breathingSamples,
    mindfulSamples,
    wristTempSamples,
    workoutSamples,
  ] = await Promise.all([
    // Activity — cumulative sums
    daySum('HKQuantityTypeIdentifierStepCount',              from, to),
    daySum('HKQuantityTypeIdentifierDistanceWalkingRunning', from, to),
    daySum('HKQuantityTypeIdentifierActiveEnergyBurned',     from, to),
    daySum('HKQuantityTypeIdentifierBasalEnergyBurned',      from, to),
    daySum('HKQuantityTypeIdentifierAppleExerciseTime',      from, to),
    daySum('HKQuantityTypeIdentifierAppleStandTime',         from, to),

    // Heart & Cardio
    dayAvg('HKQuantityTypeIdentifierHeartRate',                   from, to),
    latestSample('HKQuantityTypeIdentifierRestingHeartRate',      from, to),
    latestSample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', from, to),
    latestSample('HKQuantityTypeIdentifierVO2Max',                from, to),

    // Respiratory
    dayAvg('HKQuantityTypeIdentifierRespiratoryRate',   from, to),
    dayAvg('HKQuantityTypeIdentifierOxygenSaturation',  from, to), // 0.0–1.0 fraction

    // Sunlight
    daySum('HKQuantityTypeIdentifierTimeInDaylight', from, to),
    daySum('HKQuantityTypeIdentifierUVExposure',     from, to),

    // Morning steps (6am–10am)
    daySum('HKQuantityTypeIdentifierStepCount', morningFrom, morningTo),

    // Category samples — sleep, stand, breathing, mindful
    safeQuery(() => Core.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      { from: sleepFrom, to: sleepTo },
    )),
    safeQuery(() => Core.queryCategorySamples(
      'HKCategoryTypeIdentifierAppleStandHour',
      { from, to },
    )),
    safeQuery(() => Core.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepingBreathingDisturbances',
      { from: sleepFrom, to: sleepTo },
    )),
    safeQuery(() => Core.queryCategorySamples(
      'HKCategoryTypeIdentifierMindfulSession',
      { from, to },
    )),

    // Wrist temperature — quantity samples over sleep window
    safeQuery(() => Core.queryQuantitySamples(
      'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
      { from: sleepFrom, to: sleepTo },
    )),

    // Workouts
    safeQuery(() => Core.queryWorkoutSamples({ from, to })),
  ]);

  // ── Stand hours ─────────────────────────────────────────────────────────────
  // HKCategoryValueAppleStandHourStood = 1; Idle = 0
  const standHours = standSamples != null
    ? standSamples.filter(s => s.value === 1).length
    : null;

  // ── Sleep ────────────────────────────────────────────────────────────────────
  // Asleep stages: 1 = Asleep (legacy), 3 = REM, 4 = Core, 5 = Deep (iOS 16+)
  // Exclude: 0 = InBed, 2 = Awake
  let sleepDurationMinutes = null;
  let sleepStart           = null;
  let sleepEnd             = null;

  if (sleepSamples && sleepSamples.length > 0) {
    const ASLEEP_VALUES = new Set([1, 3, 4, 5]);
    const asleep = sleepSamples.filter(s => ASLEEP_VALUES.has(s.value));
    if (asleep.length > 0) {
      const totalMs = asleep.reduce((sum, s) => {
        const ms = new Date(s.endDate) - new Date(s.startDate);
        return sum + Math.max(0, ms);
      }, 0);
      sleepDurationMinutes = totalMs / 60_000;
      sleepStart = asleep.reduce(
        (earliest, s) => new Date(s.startDate) < new Date(earliest) ? s.startDate : earliest,
        asleep[0].startDate,
      );
      sleepEnd = asleep.reduce(
        (latest, s) => new Date(s.endDate) > new Date(latest) ? s.endDate : latest,
        asleep[0].endDate,
      );
    }
  }

  // ── Breathing disturbances ──────────────────────────────────────────────────
  // Each category sample represents one disturbance event during sleep
  const sleepBreathingDisturbances = breathingSamples != null
    ? breathingSamples.length
    : null;

  // ── Mindful minutes ──────────────────────────────────────────────────────────
  let mindfulMinutes = null;
  if (mindfulSamples && mindfulSamples.length > 0) {
    const totalMs = mindfulSamples.reduce((sum, s) => {
      return sum + Math.max(0, new Date(s.endDate) - new Date(s.startDate));
    }, 0);
    mindfulMinutes = totalMs / 60_000;
  }

  // ── Wrist temperature (°C) ───────────────────────────────────────────────────
  let wristTempCelsius = null;
  if (wristTempSamples && wristTempSamples.length > 0) {
    const vals = wristTempSamples
      .map(s => (typeof s.quantity === 'number' ? s.quantity : null))
      .filter(v => v != null);
    if (vals.length > 0) {
      wristTempCelsius = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  // ── SpO2 — normalise to percentage ──────────────────────────────────────────
  // HK stores as 0.0–1.0 fraction; guard against devices that return 0–100 already
  let spo2Percent = null;
  if (rawSpo2 != null) {
    spo2Percent = rawSpo2 <= 1.0 ? rawSpo2 * 100 : rawSpo2;
  }

  // ── Workouts ─────────────────────────────────────────────────────────────────
  let workouts = null;
  if (workoutSamples && workoutSamples.length > 0) {
    workouts = workoutSamples.map(w => ({
      type:             w.workoutActivityType ?? w.workoutType ?? null,
      duration_seconds: typeof w.duration === 'number' ? Math.round(w.duration) : null,
      energy_kcal:      w.totalEnergyBurned?.quantity ?? w.totalEnergyBurned?.value ?? null,
    }));
  }

  // ── Assemble final row ───────────────────────────────────────────────────────
  return {
    date,
    // Activity
    steps:                        steps        != null ? Math.round(steps)        : null,
    distance_meters:              distanceMeters,
    active_energy_kcal:           activeEnergyKcal,
    basal_energy_kcal:            basalEnergyKcal,
    exercise_minutes:             exerciseMinutes,
    stand_hours:                  standHours,
    stand_minutes:                standTimeMinutes,
    // Sleep
    sleep_duration_minutes:       sleepDurationMinutes,
    sleep_start:                  sleepStart,
    sleep_end:                    sleepEnd,
    sleep_breathing_disturbances: sleepBreathingDisturbances,
    // Heart & Cardio
    heart_rate_avg_bpm:           heartRateAvg,
    resting_heart_rate_bpm:       restingHeartRate,
    hrv_sdnn_ms:                  hrv,
    vo2_max:                      vo2Max,
    // Respiratory
    respiratory_rate_bpm:         respiratoryRate,
    spo2_percent:                 spo2Percent,
    // Sunlight
    daylight_minutes:             daylightMinutes,
    uv_exposure:                  uvExposure,
    // Mind
    mindful_minutes:              mindfulMinutes,
    // Temperature
    wrist_temp_celsius:           wristTempCelsius,
    // Workouts (JSONB array or null)
    workouts,
    // Morning activity
    morning_steps:                morningSteps != null ? Math.round(morningSteps) : null,
  };
}

// ─── Null skeleton ─────────────────────────────────────────────────────────────
// Returned when HealthKit is unavailable (Android, Expo Go, simulator).

function buildNullMetrics(date) {
  return {
    date,
    steps:                        null,
    distance_meters:              null,
    active_energy_kcal:           null,
    basal_energy_kcal:            null,
    exercise_minutes:             null,
    stand_hours:                  null,
    stand_minutes:                null,
    sleep_duration_minutes:       null,
    sleep_start:                  null,
    sleep_end:                    null,
    sleep_breathing_disturbances: null,
    heart_rate_avg_bpm:           null,
    resting_heart_rate_bpm:       null,
    hrv_sdnn_ms:                  null,
    vo2_max:                      null,
    respiratory_rate_bpm:         null,
    spo2_percent:                 null,
    daylight_minutes:             null,
    uv_exposure:                  null,
    mindful_minutes:              null,
    wrist_temp_celsius:           null,
    workouts:                     null,
    morning_steps:                null,
  };
}
