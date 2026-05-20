// =============================================================================
// Niyama Life — config.js
// Single source of truth for habits, points, tiers, and reward logic.
// SHARED SECTION is identical to web app src/config.js.
// Never hardcode habit names, points, or tier prices anywhere else.
// =============================================================================

// ─── SHARED: TIER CONFIG ──────────────────────────────────────────────────────
// custom_habit_slots: 0 = can track custom habits but earn 0 pts
// max_cap: absolute ceiling including milestones (undefined = reward_cap)

export const TIER_CONFIG = {
  free_trial: {
    reward_cap: 2.50,
    label: 'Free',
    trial: true,
    custom_habit_slots: 0,
    milestones: {},
    rewards_active_months: 3,
  },
  free_expired: {
    reward_cap: 0,
    label: 'Free',
    trial: false,
    custom_habit_slots: 0,
    milestones: {},
  },
  basic: {
    reward_cap: 5.00,
    label: 'Basic',
    custom_habit_slots: 0,
    milestones: {},
  },
  plus: {
    reward_cap: 10.00,
    max_cap: 17.50,
    label: 'Plus',
    custom_habit_slots: 2,
    milestones: {
      days_20_bonus: 2.50,
      successful_month_bonus: 5.00,
      perfect_month_bonus: 7.50,
    },
  },
  premium: {
    reward_cap: 25.00,
    max_cap: 35.00,
    label: 'Premium',
    custom_habit_slots: 4,
    milestones: {
      days_10_bonus: 2.50,
      days_20_bonus: 5.00,
      successful_month_bonus: 7.50,
      perfect_month_bonus: 10.00,
    },
  },
}

// ─── SHARED: ACCOUNT AGE GATES (days since signup) ───────────────────────────
// Only enforced for free_trial. Paid tiers have no age gate.

export const AGE_GATE = {
  baseCapRedemption: 30,
  milestoneBonuses: 60,
}

// ─── SHARED: POINTS CONVERSION ───────────────────────────────────────────────

export const POINTS_PER_DOLLAR = 1000  // 1,000 pts = $1.00 (all tiers)

// ─── SHARED: CORE HABITS (3) — HealthKit auto-verified ───────────────────────

export const CORE_HABITS = [
  {
    key: 'wake',
    label: 'Wake Consistency',
    icon: '🌅',
    points: 100,
    healthKitType: 'HKSleepAnalysis',
    verificationMethod: 'healthkit',
    description: 'Wake within 30 minutes of your target wake time.',
  },
  {
    key: 'sleep',
    label: 'Sleep Duration (7–9 hrs)',
    icon: '😴',
    points: 100,
    healthKitType: 'HKSleepAnalysis',
    verificationMethod: 'healthkit',
    description: 'Get between 7 and 9 hours of sleep.',
  },
  {
    key: 'steps',
    label: 'Steps',
    icon: '👟',
    points: null,
    healthKitType: 'HKStepCount',
    verificationMethod: 'healthkit',
    description: 'Hit your step goal for the day.',
    tiers: [
      { threshold: 10000, points: 100 },
      { threshold: 7500,  points: 75 },
      { threshold: 5000,  points: 50 },
    ],
  },
]

// ─── SHARED: STEPS TIERS ─────────────────────────────────────────────────────

export const STEPS_TIERS = [
  { threshold: 10000, points: 100 },
  { threshold: 7500,  points: 75 },
  { threshold: 5000,  points: 50 },
  { threshold: 0,     points: 0 },
]

export function calcStepsPoints(steps) {
  for (const tier of STEPS_TIERS) {
    if (steps >= tier.threshold) return tier.points
  }
  return 0
}

// ─── SHARED: LIBRARY HABITS (7) — Fixed for all users, no selection ──────────

export const LIBRARY_HABITS = [
  {
    key: 'screen_time',
    label: 'Screen Time < 4 hours',
    icon: '📵',
    points: 50,
    verificationMethod: 'honour',
    healthKitType: null,
    description: 'Keep total screen time under 4 hours.',
    phase6Note: 'ScreenTime verification coming soon.',
  },
  {
    key: 'no_phone',
    label: 'No Phone after 10:30pm',
    icon: '🌙',
    points: 50,
    verificationMethod: 'honour',
    healthKitType: null,
    description: 'Put your phone away before 10:30pm.',
  },
  {
    key: 'stand',
    label: 'Stand Consistency',
    icon: '🧍',
    points: 50,
    verificationMethod: 'verified',
    healthKitType: 'HKAppleStandHour',
    description: 'Stand at least 1 min every hour.',
  },
  {
    key: 'sunlight',
    label: 'Morning Sunlight (10+ min)',
    icon: '☀️',
    points: 50,
    verificationMethod: 'confirmable',
    healthKitType: null,
    description: 'Get at least 10 minutes of morning sunlight.',
  },
  {
    key: 'no_late_food',
    label: 'No Late Food after 8pm',
    icon: '🍽️',
    points: 50,
    verificationMethod: 'confirmable',
    healthKitType: null,
    description: 'Stop eating before 8pm.',
  },
  {
    key: 'recovery',
    label: 'Recovery Practice — Yoga/Stretching',
    icon: '🧘',
    points: 50,
    verificationMethod: 'confirmable',
    healthKitType: null,
    description: 'Yoga, stretching, or mobility work.',
  },
  {
    key: 'meditation',
    label: 'Meditation (10+ min)',
    icon: '🪷',
    points: 50,
    verificationMethod: 'honour',
    healthKitType: null,
    description: 'Meditate for at least 10 minutes.',
  },
]

// ─── SHARED: POINTS CONSTANTS ────────────────────────────────────────────────

export const POINTS = {
  core_habit: 100,
  library_habit: 50,
  custom_habit: 25,
  successful_day: 50,
  perfect_day: 100,
}

// ─── SHARED: DAY SUCCESS / PERFECT RULES ─────────────────────────────────────
// Arguments are integer counts. Custom habits excluded from thresholds.

export function isSuccessfulDay(coreCompleted, libraryCompleted) {
  return coreCompleted >= 2 && libraryCompleted >= 3
}

export function isPerfectDay(coreCompleted, libraryCompleted) {
  return coreCompleted >= 3 && libraryCompleted >= 7
}

// ─── SHARED: DAY POINTS CALCULATOR ───────────────────────────────────────────
// corePoints: already computed (steps tiered via calcStepsPoints)
// libraryCompleted: integer count
// customCompleted: integer count of completed custom habits
// tier: effective tier key (use getEffectiveTier first)
// Returns integer total — no daily cap.

export function calcDayPoints(corePoints, libraryCompleted, customCompleted, tier) {
  const libraryPoints = libraryCompleted * POINTS.library_habit
  const slots = TIER_CONFIG[tier]?.custom_habit_slots ?? 0
  const customPoints = Math.min(customCompleted ?? 0, slots) * POINTS.custom_habit
  // Math.ceil(corePoints / 100) correctly yields completed count for all step tiers
  const coreCompleted = corePoints > 0 ? Math.ceil(corePoints / 100) : 0
  const successBonus = isSuccessfulDay(coreCompleted, libraryCompleted) ? POINTS.successful_day : 0
  const perfectBonus = isPerfectDay(coreCompleted, libraryCompleted) ? POINTS.perfect_day : 0
  return corePoints + libraryPoints + customPoints + successBonus + perfectBonus
}

// ─── SHARED: TIER HELPERS ────────────────────────────────────────────────────

export function getMemberMonths(createdAt) {
  if (!createdAt) return 0
  const joined = new Date(createdAt)
  const now = new Date()
  return (now.getFullYear() - joined.getFullYear()) * 12
    + (now.getMonth() - joined.getMonth())
}

export function getEffectiveTier(tier, createdAt) {
  if (tier !== 'free') return tier
  return getMemberMonths(createdAt) < 3 ? 'free_trial' : 'free_expired'
}

// ─── SHARED: REWARD CALCULATOR ───────────────────────────────────────────────
// Milestones are ADDITIVE — every qualifying threshold adds its bonus.
// Age gate applies only to free_trial (not paid tiers).
// consecutiveInactiveDays ≥ 5 → $0 for that month.

export function calcReward(
  monthlyPoints,
  effectiveTier,
  successfulDays,
  isSuccessfulMonth,
  isPerfectMonth,
  consecutiveInactiveDays,
  accountCreatedAt,
) {
  const config = TIER_CONFIG[effectiveTier]
  if (!config || config.reward_cap === 0) return '0.00'
  if ((consecutiveInactiveDays || 0) >= 5) return '0.00'

  if (effectiveTier === 'free_trial' && accountCreatedAt) {
    const days = Math.floor((Date.now() - new Date(accountCreatedAt)) / 86400000)
    if (days < AGE_GATE.baseCapRedemption) return '0.00'
  }

  const base = Math.min((monthlyPoints || 0) / POINTS_PER_DOLLAR, config.reward_cap)
  let bonus = 0

  if (config.milestones) {
    const milestoneEligible =
      effectiveTier !== 'free_trial' ||
      !accountCreatedAt ||
      Math.floor((Date.now() - new Date(accountCreatedAt)) / 86400000) >= AGE_GATE.milestoneBonuses

    if (milestoneEligible) {
      if (config.milestones.days_10_bonus      && (successfulDays || 0) >= 10)  bonus += config.milestones.days_10_bonus
      if (config.milestones.days_20_bonus      && (successfulDays || 0) >= 20)  bonus += config.milestones.days_20_bonus
      if (config.milestones.successful_month_bonus && isSuccessfulMonth)         bonus += config.milestones.successful_month_bonus
      if (config.milestones.perfect_month_bonus    && isPerfectMonth)            bonus += config.milestones.perfect_month_bonus
    }
  }

  const total = Math.min(base + bonus, config.max_cap || config.reward_cap)
  return total.toFixed(2)
}

// ─── SHARED: DATE HELPER ─────────────────────────────────────────────────────

export function getTodayString() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

// ─── SHARED: EVENT TRACKING (Supabase + PostHog + Mixpanel) ─────────────────

import { posthog, mixpanel } from './analytics'

export async function trackEvent(supabase, userId, eventType, eventData = {}) {
  const payload = { ...eventData, timestamp: new Date().toISOString(), hour: new Date().getHours() }

  // 1. Supabase event log (fails silently if userId is null)
  try {
    await supabase.from('app_events').insert({
      user_id:    userId,
      event_type: eventType,
      event_data: payload,
    })
  } catch (_) {}

  // 2. PostHog
  try { posthog?.capture(eventType, { ...payload, user_id: userId }) } catch (_) {}

  // 3. Mixpanel
  try { mixpanel?.track(eventType, { ...payload, user_id: userId }) } catch (_) {}
}

// =============================================================================
// MOBILE-ONLY BELOW — not mirrored to web config
// =============================================================================

// ─── MOBILE: BACKWARD COMPAT TIER DISPLAY OBJECT ─────────────────────────────
// UI components (onboarding, rewards) use TIERS['free'/'basic'/'plus'/'premium'].
// For reward calculations always call getEffectiveTier() + TIER_CONFIG.

export const TIER_ORDER = ['free', 'basic', 'plus', 'premium']

export const TIERS = {
  free: {
    key: 'free',
    label: 'Free',
    price: { monthly: 0, annual: 0 },
    customHabitPointSlots: TIER_CONFIG.free_trial.custom_habit_slots,
    custom_habit_slots: TIER_CONFIG.free_trial.custom_habit_slots,
    baseCap: TIER_CONFIG.free_trial.reward_cap,
    reward_cap: TIER_CONFIG.free_trial.reward_cap,
    baseCapMonthsLimit: TIER_CONFIG.free_trial.rewards_active_months,
    milestones: {},
    maxMonthly: TIER_CONFIG.free_trial.reward_cap,
    max_cap: TIER_CONFIG.free_trial.reward_cap,
  },
  basic: {
    key: 'basic',
    label: 'Basic',
    price: { monthly: 0.99, annual: 9.99 },
    customHabitPointSlots: TIER_CONFIG.basic.custom_habit_slots,
    custom_habit_slots: TIER_CONFIG.basic.custom_habit_slots,
    baseCap: TIER_CONFIG.basic.reward_cap,
    reward_cap: TIER_CONFIG.basic.reward_cap,
    baseCapMonthsLimit: null,
    milestones: {},
    maxMonthly: TIER_CONFIG.basic.reward_cap,
    max_cap: TIER_CONFIG.basic.reward_cap,
  },
  plus: {
    key: 'plus',
    label: 'Plus',
    price: { monthly: 4.99, annual: 49.99 },
    customHabitPointSlots: TIER_CONFIG.plus.custom_habit_slots,
    custom_habit_slots: TIER_CONFIG.plus.custom_habit_slots,
    baseCap: TIER_CONFIG.plus.reward_cap,
    reward_cap: TIER_CONFIG.plus.reward_cap,
    baseCapMonthsLimit: null,
    milestones: {
      successfulDays20: TIER_CONFIG.plus.milestones.days_20_bonus,
      successfulMonth:  TIER_CONFIG.plus.milestones.successful_month_bonus,
      perfectMonth:     TIER_CONFIG.plus.milestones.perfect_month_bonus,
    },
    maxMonthly: TIER_CONFIG.plus.max_cap,
    max_cap: TIER_CONFIG.plus.max_cap,
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    price: { monthly: 14.99, annual: 149.99 },
    customHabitPointSlots: TIER_CONFIG.premium.custom_habit_slots,
    custom_habit_slots: TIER_CONFIG.premium.custom_habit_slots,
    baseCap: TIER_CONFIG.premium.reward_cap,
    reward_cap: TIER_CONFIG.premium.reward_cap,
    baseCapMonthsLimit: null,
    milestones: {
      successfulDays10: TIER_CONFIG.premium.milestones.days_10_bonus,
      successfulDays20: TIER_CONFIG.premium.milestones.days_20_bonus,
      successfulMonth:  TIER_CONFIG.premium.milestones.successful_month_bonus,
      perfectMonth:     TIER_CONFIG.premium.milestones.perfect_month_bonus,
    },
    maxMonthly: TIER_CONFIG.premium.max_cap,
    max_cap: TIER_CONFIG.premium.max_cap,
  },
}

// ─── MOBILE: HABIT DERIVED CONSTANTS ─────────────────────────────────────────

export const CORE_HABIT_KEYS    = CORE_HABITS.map(h => h.key)
export const LIBRARY_HABIT_KEYS = LIBRARY_HABITS.map(h => h.key)
export const CORE_MAX_POINTS    = 300  // all 3 core at 100pts (10k steps)
export const LIBRARY_MAX_POINTS = LIBRARY_HABITS.reduce((s, h) => s + h.points, 0)  // 350
export const ALL_FIXED_HABITS   = [...CORE_HABITS, ...LIBRARY_HABITS]

// ─── MOBILE: STEPS HELPERS ───────────────────────────────────────────────────

export function getStepsPoints(stepCount) {
  return calcStepsPoints(stepCount)
}

export function getStepsLabel(stepCount) {
  const pts = calcStepsPoints(stepCount)
  return `${stepCount.toLocaleString()} steps · ${pts} pts`
}

// ─── MOBILE: CUSTOM HABITS ───────────────────────────────────────────────────

export const CUSTOM_HABIT_POINTS = POINTS.custom_habit  // 25

export function getCustomHabitPointSlots(tier) {
  return TIER_CONFIG[tier]?.custom_habit_slots ?? TIERS[tier]?.custom_habit_slots ?? 0
}

export function getCustomHabitPoints(tier, customHabits) {
  const slots = getCustomHabitPointSlots(tier)
  const completed = customHabits.filter(h => h.completed).length
  return Math.min(completed, slots) * CUSTOM_HABIT_POINTS
}

// ─── MOBILE: DAY SUCCESS CONSTANTS ───────────────────────────────────────────

export const SUCCESSFUL_DAY_THRESHOLD = { core: 2, library: 3 }
export const SUCCESSFUL_DAY_BONUS     = POINTS.successful_day   // 50
export const PERFECT_DAY_BONUS        = POINTS.perfect_day      // 100
export const SOCIAL_SHARE_BONUS       = 20  // max 1 per day

// ─── MOBILE: FULL DAY POINTS CALCULATOR (backward compat object API) ─────────
// Wraps the canonical calcDayPoints; adds social share bonus (mobile only).

export function calculateDayPoints({
  tier,
  completedCoreKeys = [],
  completedLibraryKeys = [],
  customHabits = [],
  stepCount = 0,
  socialShared = false,
}) {
  const corePoints = completedCoreKeys.reduce((sum, key) => {
    if (key === 'steps') return sum + calcStepsPoints(stepCount ?? 0)
    const habit = CORE_HABITS.find(h => h.key === key)
    return sum + (habit?.points ?? 0)
  }, 0)

  const libraryCompleted = completedLibraryKeys.length
  const customCompleted  = customHabits.filter(h => h.completed).length
  const effectiveTier    = tier  // caller passes effective tier for this fn

  const base        = calcDayPoints(corePoints, libraryCompleted, customCompleted, effectiveTier)
  const shareBonus  = socialShared ? SOCIAL_SHARE_BONUS : 0
  const coreCount   = completedCoreKeys.length
  const successful  = isSuccessfulDay(coreCount, libraryCompleted)
  const perfect     = isPerfectDay(coreCount, libraryCompleted)

  // Recompute breakdown for callers that read individual fields
  const libraryPoints = libraryCompleted * POINTS.library_habit
  const slots         = TIER_CONFIG[effectiveTier]?.custom_habit_slots ?? 0
  const customPoints  = Math.min(customCompleted, slots) * POINTS.custom_habit
  const successBonus  = successful ? SUCCESSFUL_DAY_BONUS : 0
  const perfectBonus  = perfect    ? PERFECT_DAY_BONUS    : 0

  return {
    core: corePoints,
    library: libraryPoints,
    custom: customPoints,
    successBonus,
    perfectBonus,
    shareBonus,
    total: base + shareBonus,
    successful,
    perfect,
  }
}

// ─── MOBILE: MILESTONE BONUS (ADDITIVE — matches web calcReward logic) ────────

export function calculateMonthMilestoneBonus(tier, { successfulDaysCount, perfectDaysCount, totalDaysInMonth }) {
  const effectiveTier = getEffectiveTier(tier, null)  // no createdAt: assume eligible
  const config        = TIER_CONFIG[effectiveTier] ?? TIER_CONFIG[tier]
  const milestones    = config?.milestones ?? {}
  let bonus = 0

  const isSuccessfulMonth = successfulDaysCount >= totalDaysInMonth
  const isPerfectMon      = perfectDaysCount    >= totalDaysInMonth

  // ADDITIVE — all qualifying milestones sum
  if (milestones.days_10_bonus      && successfulDaysCount >= 10)  bonus += milestones.days_10_bonus
  if (milestones.days_20_bonus      && successfulDaysCount >= 20)  bonus += milestones.days_20_bonus
  if (milestones.successful_month_bonus && isSuccessfulMonth)       bonus += milestones.successful_month_bonus
  if (milestones.perfect_month_bonus    && isPerfectMon)            bonus += milestones.perfect_month_bonus

  return bonus
}

export function getActiveMilestone(tier, successfulDaysCount, perfectDaysCount, totalDaysInMonth) {
  const effectiveTier = getEffectiveTier(tier, null)
  const config        = TIER_CONFIG[effectiveTier] ?? TIER_CONFIG[tier]
  const milestones    = config?.milestones ?? {}
  const isSuccessfulMonth = successfulDaysCount >= totalDaysInMonth
  const isPerfectMon      = perfectDaysCount    >= totalDaysInMonth

  // Return highest achieved (for display purposes)
  if (isPerfectMon       && milestones.perfect_month_bonus)     return 'perfect_month_bonus'
  if (isSuccessfulMonth  && milestones.successful_month_bonus)  return 'successful_month_bonus'
  if (successfulDaysCount >= 20 && milestones.days_20_bonus)    return 'days_20_bonus'
  if (successfulDaysCount >= 10 && milestones.days_10_bonus)    return 'days_10_bonus'
  return null
}

export const MILESTONE_DEFINITIONS = [
  {
    key: 'days_10_bonus',
    label: '10 Successful Days',
    requiredSuccessful: 10,
    tiers: { premium: 2.50 },
  },
  {
    key: 'days_20_bonus',
    label: '20 Successful Days',
    requiredSuccessful: 20,
    tiers: { plus: 2.50, premium: 5.00 },
  },
  {
    key: 'successful_month_bonus',
    label: 'Successful Month',
    requiresFullMonth: true,
    tiers: { plus: 5.00, premium: 7.50 },
  },
  {
    key: 'perfect_month_bonus',
    label: 'Perfect Month',
    requiresFullPerfect: true,
    tiers: { plus: 7.50, premium: 10.00 },
  },
]

// ─── MOBILE: ACCOUNT ELIGIBILITY HELPERS ─────────────────────────────────────

export function canRedeemBaseCap(accountCreatedAt) {
  const days = Math.floor((Date.now() - new Date(accountCreatedAt)) / 86400000)
  return days >= AGE_GATE.baseCapRedemption
}

export function canRedeemMilestoneBonuses(accountCreatedAt) {
  const days = Math.floor((Date.now() - new Date(accountCreatedAt)) / 86400000)
  return days >= AGE_GATE.milestoneBonuses
}

export function isFreeRewardExpired(tier, accountCreatedAt) {
  if (tier !== 'free') return false
  const months = (Date.now() - new Date(accountCreatedAt)) / (30 * 86400000)
  return months > TIERS.free.baseCapMonthsLimit
}

// ─── MOBILE: MINOR PROTECTION ────────────────────────────────────────────────

export function isMinorUser(dateOfBirth) {
  if (!dateOfBirth) return false
  const age = (Date.now() - new Date(dateOfBirth)) / (365.25 * 86400000)
  return age < 18
}

// ─── MOBILE: HEALTHKIT DATA TYPES ────────────────────────────────────────────
// Full HK type identifier strings required by @kingstinct/react-native-healthkit.
// Pass directly to Core.requestAuthorization({ toRead: HEALTHKIT_READ_TYPES }).

export const HEALTHKIT_READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierAppleStandHour',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate',
]

// ─── MOBILE: MOOD CHECK-IN ───────────────────────────────────────────────────

export const MOOD_OPTIONS = [
  { value: 1, emoji: '😩', label: 'Rough day' },
  { value: 2, emoji: '😕', label: 'Not great' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good day' },
  { value: 5, emoji: '🔥', label: 'Amazing' },
]

// ─── MOBILE: STREAK MILESTONES ───────────────────────────────────────────────

export const STREAK_MILESTONES = [
  { days: 30, message: 'Legendary' },
  { days: 14, message: 'Unstoppable' },
  { days: 7,  message: 'Building momentum' },
]

export function getStreakMessage(streakDays) {
  for (const m of STREAK_MILESTONES) {
    if (streakDays >= m.days) return m.message
  }
  return null
}

export function showStreakFlame(streakDays) {
  return streakDays >= 14
}

// ─── MOBILE: GREETING ────────────────────────────────────────────────────────

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── MOBILE: NOTIFICATION TYPES ──────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  morningWake: {
    key: 'morning_wake',
    title: 'Rise and shine ☀️',
    body: 'Time to start your day with intention.',
  },
  middayCheckIn: {
    key: 'midday_check_in',
    title: 'Midday check-in 🌿',
    body: "How's your day going? Log your habits.",
  },
  streakProtection: {
    key: 'streak_protection',
    title: 'Protect your streak 🔥',
    body: "Don't forget to submit today before midnight.",
  },
  giftCardDelivered: {
    key: 'gift_card_delivered',
    title: 'Your reward is here 🎁',
    body: 'Your gift card has been delivered. Nice work.',
  },
}

// ─── MOBILE: GIFT CARD BRANDS ────────────────────────────────────────────────

export const GIFT_CARD_BRANDS = [
  'Amazon', 'Starbucks', 'Nike', 'Apple', 'Target',
  'Walmart', 'Whole Foods', 'Sephora', 'Uber Eats', 'Google Play',
]

// ─── MOBILE: SUPABASE SCHEMA KEYS ────────────────────────────────────────────

export const DB = {
  tables: {
    habitLogs:       'habit_logs',
    dailySummaries:  'daily_summaries',
    profiles:        'profiles',
    biometrics:      'biometrics',
  },
  habitLogs: {
    userId:    'user_id',
    habitKey:  'habit_key',
    date:      'date',
    completed: 'completed',
    verified:  'verified',
    createdAt: 'created_at',
  },
  dailySummaries: {
    userId:       'user_id',
    date:         'date',
    totalPoints:  'total_points',
    daySuccessful: 'day_successful',
    perfectDay:   'perfect_day',
    submitted:    'submitted',
    mood:         'mood',
  },
  profiles: {
    id:                     'id',
    tier:                   'tier',
    createdAt:              'created_at',
    wakeTime:               'wake_time',
    movementPreference:     'movement_preference',
    successfulDays:         'successful_days',
    monthlyPoints:          'monthly_points',
    consecutiveInactiveDays: 'consecutive_inactive_days',
    totalDaysLogged:        'total_days_logged',
    referralCode:           'referral_code',
    dateOfBirth:            'date_of_birth',
    isMinor:                'is_minor',
    region:                 'region',
    healthkitConnected:     'healthkit_connected',
    researchConsent:        'research_consent',
    onboardingComplete:     'onboarding_complete',
  },
}
