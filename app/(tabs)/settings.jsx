import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Switch,
  Modal, TextInput, Alert, ActivityIndicator, Share,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../../src/context/AuthContext';
import NiyamaIcon from '../../src/components/NiyamaIcon';
import { scheduleAllRecurring } from '../../src/notifications';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import { TIERS, DB, isMinorUser, CUSTOM_HABIT_POINTS, trackEvent, HEALTHKIT_READ_TYPES } from '../../src/config';

// ─── HealthKit (iOS-only) ────────────────────────────────────────────────────

let Core = null;
if (Platform.OS === 'ios') {
  try {
    Core = require('@kingstinct/react-native-healthkit').default;
  } catch {
    // unavailable in Expo Go / non-native builds
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_COLORS = {
  free:    colors.textMuted,
  basic:   '#7A8FA6',
  plus:    colors.primary,
  premium: colors.accent,
};

const HOW_IT_WORKS = [
  { q: 'How are points calculated?', a: 'You earn points for each habit you complete. Core habits (wake, sleep, steps) use HealthKit data. Library habits use the honour system or photo confirmations. A Successful Day bonus (+50 pts) applies when you hit 2+ core and 3+ library habits. A Perfect Day bonus (+100 pts) applies when you complete all 10.' },
  { q: 'How do rewards work?', a: 'Every 1,000 points = $1.00 of reward value. At the end of each month, your points convert to a dollar amount up to your tier cap. Redeem as gift cards once your account is 30+ days old.' },
  { q: 'What are milestone bonuses?', a: 'Plus and Premium members unlock milestone bonuses on top of the base cap. Requires 60+ days on the platform.' },
  { q: 'How does HealthKit verification work?', a: "For HealthKit-verified habits, Niyama reads your Apple Health data. There's a 2–3 second verification window after you check a habit. You never lose points — if HealthKit data is unavailable, the check still counts." },
  { q: 'What is a Perfect Day?', a: 'All 10 habits completed (3 core + 7 library). Custom habits are excluded from this threshold but still earn points.' },
];

const EMOJI_LIST = [
  '💪','🏃','🧘','🌿','💧','📚','🎯','🌅','🥗','😴',
  '🚶','🍎','☕','🎵','🌸','🏋️','🚴','🧠','❤️','✍️',
  '🌊','🎨','🔥','⭐','🌙','🦋','🎸','🌺','🧩','🕯️',
];

const SUB_TITLES = {
  'my-habits':        'My Habits',
  'plan-rewards':     'Your Plan & Rewards',
  'billing':          'Billing',
  'how-niyama-works': 'How Niyama Works',
  'referrals':        'Referrals',
  'data-research':    'Data & Research',
  'legal':            'Legal & Trust',
};

// ─── Shared sub-components ──────────────────────────────────────────────────

function NavRow({ icon, label, subtitle, onPress, chevron = true, danger = false, badge, last, rightLabel, rightLabelStyle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.navRow, last && s.lastRow, pressed && { opacity: 0.65 }]}
    >
      {icon != null && (
        <View style={[s.navIcon, danger && s.navIconDanger]}>
          <Text style={s.navIconEmoji}>{icon}</Text>
        </View>
      )}
      <View style={s.navRowCenter}>
        <View style={s.navRowTopLine}>
          <Text style={[s.navRowLabel, danger && s.navRowDanger]}>{label}</Text>
          {badge != null && (
            <View style={s.navBadge}>
              <Text style={s.navBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle ? <Text style={s.navRowSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightLabel != null && (
        <Text style={[s.navRowRight, rightLabelStyle]}>{rightLabel}</Text>
      )}
      {chevron && !danger && rightLabel == null && <Text style={s.chevron}>›</Text>}
    </Pressable>
  );
}

function Group({ label, children }) {
  return (
    <View style={s.group}>
      {label ? <Text style={s.groupLabel}>{label}</Text> : null}
      <View style={s.groupCard}>{children}</View>
    </View>
  );
}

function SectionCard({ children, style }) {
  return <View style={[s.sectionCard, style]}>{children}</View>;
}

function InfoCard({ children, tinted }) {
  return <View style={[s.infoCard, tinted && s.infoCardTinted]}>{children}</View>;
}

function Row({ label, value, valueStyle, last }) {
  const isNode = value && typeof value === 'object';
  return (
    <View style={[s.row, last && s.lastRow]}>
      <Text style={s.rowLabel}>{label}</Text>
      {isNode ? value : <Text style={[s.rowValue, valueStyle]}>{value ?? '—'}</Text>}
    </View>
  );
}

function FaqRow({ question, answer, expanded, onPress, last }) {
  return (
    <Pressable onPress={onPress} style={[s.faqRow, last && s.lastRow]}>
      <View style={s.faqHeader}>
        <Text style={s.faqQuestion}>{question}</Text>
        <Text style={s.faqChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && <Text style={s.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SettingsTab() {
  const { session, profile, refreshProfile } = useAuth();

  // Navigation
  const [screen, setScreen] = useState('main');

  // Data
  const [customHabits, setCustomHabits] = useState([]);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  // Edit profile modal
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Add custom habit modal
  const [addHabitVisible, setAddHabitVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('💪');
  const [savingHabit, setSavingHabit] = useState(false);

  // Delete account (steps 1–3)
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');

  // Research consent
  const [researchConsent, setResearchConsent] = useState(profile?.research_consent ?? true);
  const [savingConsent, setSavingConsent] = useState(false);

  // HealthKit
  const [hkConnected, setHkConnected] = useState(false);
  const [connectingHealthKit, setConnectingHealthKit] = useState(false);

  // Wake time picker — initialized to 6:30 AM; synced from profile on screen open
  const [wakePickerTime, setWakePickerTime] = useState(() => {
    const d = new Date();
    d.setHours(6, 30, 0, 0);
    return d;
  });
  const [savingWakeTime, setSavingWakeTime] = useState(false);
  const [wakeTimeSaved, setWakeTimeSaved] = useState(false);

  // Referral copy feedback
  const [referralCopied, setReferralCopied] = useState(false);

  // Sync wake picker to profile whenever user opens My Habits screen
  useEffect(() => {
    if (screen === 'my-habits' && profile?.wake_time_minutes != null) {
      const d = new Date();
      d.setHours(Math.floor(profile.wake_time_minutes / 60), profile.wake_time_minutes % 60, 0, 0);
      setWakePickerTime(d);
      setWakeTimeSaved(false);
    }
  }, [screen]);

  useFocusEffect(
    useCallback(() => {
      loadCustomHabits();
      checkUnreadSupport();
      if (profile) {
        setEditName(profile.full_name ?? '');
      }
      // Always fetch research_consent fresh from DB on focus so the toggle
      // reflects the persisted value even if the AuthContext cache is stale.
      if (session?.user?.id) {
        supabase
          .from('profiles')
          .select('research_consent')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data != null) setResearchConsent(data.research_consent ?? true);
          });
      }
    }, [profile?.id])
  );

  // ── Data loaders ──

  async function checkUnreadSupport() {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('contact_messages')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('sender', 'admin')
      .eq('read_by_user', false)
      .limit(1);
    setHasUnreadSupport((data?.length ?? 0) > 0);
  }

  async function loadCustomHabits() {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from('custom_habits')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (!error) setCustomHabits(data ?? []);
  }

  // ── Profile ──

  async function saveProfile() {
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      await supabase.from(DB.tables.profiles).update({ full_name: editName.trim() }).eq(DB.profiles.id, session.user.id);
      await refreshProfile();
      setEditProfileVisible(false);
    } catch (_) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Custom habits ──

  async function addCustomHabit() {
    if (!newHabitName.trim()) return;
    setSavingHabit(true);
    try {
      const { error } = await supabase.from('custom_habits').insert({
        user_id: session.user.id,
        name: newHabitName.trim(),
        emoji: newHabitEmoji,
        is_active: true,
        sort_order: customHabits.length,
      });
      if (error) throw error;
      await loadCustomHabits();
      setAddHabitVisible(false);
      setNewHabitName('');
      setNewHabitEmoji('💪');
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not add habit. Please try again.');
    } finally {
      setSavingHabit(false);
    }
  }

  async function deleteCustomHabit(id) {
    try {
      const { error } = await supabase
        .from('custom_habits')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      setCustomHabits(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not delete habit.');
    }
  }

  // ── Preferences ──

  async function toggleResearchConsent(val) {
    setResearchConsent(val);
    setSavingConsent(true);
    try {
      await supabase.from(DB.tables.profiles).update({ research_consent: val }).eq(DB.profiles.id, session.user.id);
      // Audit trail — fire-and-forget, does not block the UI update
      trackEvent(supabase, session.user.id, 'research_consent_changed', {
        consent: val,
        source: 'settings',
      });
      await refreshProfile();
    } catch (_) {
      setResearchConsent(!val);
    } finally {
      setSavingConsent(false);
    }
  }

  // ── HealthKit ──

  async function connectAppleHealth() {
    if (!Core) {
      Alert.alert(
        'Not available',
        'Apple Health integration requires a physical device and EAS Build.'
      );
      return;
    }
    if (hkConnected || connectingHealthKit) return;
    setConnectingHealthKit(true);
    try {
      // Filter to only types supported on this device (e.g. no Apple Watch types on iPhone-only)
      const supportedTypes = [];
      for (const type of HEALTHKIT_READ_TYPES) {
        try {
          await Core.getRequestStatusForAuthorization({ toRead: [type], toShare: [] });
          supportedTypes.push(type);
        } catch {
          // Type not supported on this device — skip silently
        }
      }
      // Request all supported types in one call → single permission dialog
      if (supportedTypes.length > 0) {
        await Core.requestAuthorization({ toRead: supportedTypes, toShare: [] });
      }
      setHkConnected(true);
    } catch (_) {
      Alert.alert(
        'Could not connect',
        'Please check that Apple Health is enabled in device Settings.'
      );
    } finally {
      setConnectingHealthKit(false);
    }
  }

  // ── Wake time ──

  async function saveWakeTime() {
    const newMinutes = wakePickerTime.getHours() * 60 + wakePickerTime.getMinutes();
    setSavingWakeTime(true);
    try {
      const { error } = await supabase
        .from(DB.tables.profiles)
        .update({ wake_time_minutes: newMinutes })
        .eq(DB.profiles.id, session.user.id);
      if (error) throw error;
      await refreshProfile();
      scheduleAllRecurring(newMinutes);
      setWakeTimeSaved(true);
      setTimeout(() => setWakeTimeSaved(false), 2500);
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not save wake time.');
    } finally {
      setSavingWakeTime(false);
    }
  }

  // ── Referral copy ──

  async function copyReferralCode() {
    if (!profile?.referral_code) return;
    await Clipboard.setStringAsync(profile.referral_code);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  // ── Account ──

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); router.replace('/(auth)/welcome'); } },
    ]);
  }

  async function handleDeleteAccount() {
    if (deleteInput.trim() !== 'DELETE') return;
    setDeleteStep(3);
    try {
      await supabase.from(DB.tables.profiles).update({ delete_requested_at: new Date().toISOString() }).eq(DB.profiles.id, session.user.id);
      await supabase.auth.signOut();
      setDeleteStep(0);
      router.replace('/(auth)/welcome');
    } catch (_) {
      setDeleteStep(2);
      Alert.alert('Error', 'Could not process deletion. Please contact support@niyamalife.com');
    }
  }

  async function shareReferral() {
    const code = profile?.referral_code;
    if (!code) return;
    try {
      await Share.share({ message: `Join me on Niyama Life and build better habits together! Use my referral code ${code} at https://niyamalife.com/join` });
    } catch (_) {}
  }

  // ── Derived values ──

  const tier        = profile?.tier ?? 'free';
  const tierConfig  = TIERS[tier];
  const isMinor     = isMinorUser(profile?.date_of_birth);
  const email       = session?.user?.email ?? '';
  const name        = profile?.full_name ?? '';
  const accountCreated = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const pointSlots  = TIERS[tier]?.customHabitPointSlots ?? 0;

  // ── Render ──

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.safe}>

        {/* ── Fixed header ─────────────────────────── */}
        <View style={s.headerRow}>
          {screen !== 'main' ? (
            <>
              <Pressable onPress={() => setScreen('main')} style={s.backBtn} hitSlop={12}>
                <Text style={s.backArrow}>‹</Text>
              </Pressable>
              <Text style={s.subTitle}>{SUB_TITLES[screen] ?? ''}</Text>
              <View style={{ width: 40 }} />
            </>
          ) : (
            <Text style={s.screenTitle}>Settings</Text>
          )}
        </View>

        {/* key={screen} resets scroll position when navigating */}
        <ScrollView key={screen} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ══════════════════════════════════════════
              MAIN SCREEN
          ══════════════════════════════════════════ */}
          {screen === 'main' && (
            <>
              {/* Profile card — tapping opens Edit Profile modal */}
              <Pressable
                style={({ pressed }) => [s.profileCard, pressed && { opacity: 0.85 }]}
                onPress={() => { setEditName(profile?.full_name ?? ''); setEditProfileVisible(true); }}
              >
                <View style={s.profileAvatar}>
                  <Text style={s.profileInitials}>
                    {name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'N'}
                  </Text>
                </View>
                <View style={s.profileInfo}>
                  <Text style={s.profileName}>{name || 'Your Name'}</Text>
                  <Text style={s.profileEmail}>{email}</Text>
                  {profile?.region ? <Text style={s.profileMeta}>{profile.region}</Text> : null}
                  {accountCreated ? <Text style={s.profileMeta}>Member since {accountCreated}</Text> : null}
                </View>
                <View style={[s.tierPill, { backgroundColor: (TIER_COLORS[tier] ?? colors.primary) + '18' }]}>
                  <Text style={[s.tierPillText, { color: TIER_COLORS[tier] ?? colors.primary }]}>
                    {tierConfig?.label ?? 'Free'}
                  </Text>
                </View>
              </Pressable>

              {/* Group 1 — Habits */}
              <Group label="Habits">
                <NavRow
                  icon="⏰"
                  label="My Habits"
                  subtitle={`Wake time · your 10 habits · ${customHabits.length} custom`}
                  onPress={() => setScreen('my-habits')}
                  last
                />
              </Group>

              {/* Group 2 — Plan */}
              <Group label="Plan">
                <NavRow
                  icon="🎁"
                  label="Your Plan & Rewards"
                  subtitle={`${tierConfig?.label ?? 'Free'} · up to $${(tierConfig?.maxMonthly ?? 0).toFixed(2)}/mo`}
                  onPress={() => setScreen('plan-rewards')}
                />
                <NavRow
                  icon="💳"
                  label="Billing"
                  subtitle="Manage subscription"
                  onPress={() => setScreen('billing')}
                  last
                />
              </Group>

              {/* Group 3 — Integrations */}
              {Platform.OS === 'ios' && (
                <Group label="Integrations">
                  <NavRow
                    icon="🍎"
                    label="Apple Health"
                    subtitle={hkConnected ? 'Auto-verifies sleep, steps & stand' : 'Connect to auto-verify habits'}
                    onPress={connectAppleHealth}
                    chevron={false}
                    rightLabel={connectingHealthKit ? '…' : (hkConnected ? 'Connected' : 'Connect')}
                    rightLabelStyle={hkConnected ? s.connectedLabel : s.connectLabel}
                    last
                  />
                </Group>
              )}

              {/* Group 4 — Learn */}
              <Group label="Learn">
                <NavRow
                  icon="📖"
                  label="How Niyama Works"
                  subtitle="Points, rewards, successful days"
                  onPress={() => setScreen('how-niyama-works')}
                  last
                />
              </Group>

              {/* Group 5 — Account */}
              <Group label="Account">
                {!isMinor && (
                  <NavRow
                    icon="👥"
                    label="Referrals"
                    subtitle={profile?.referral_code ? `Code: ${profile.referral_code}` : 'Coming soon'}
                    onPress={() => setScreen('referrals')}
                  />
                )}
                <NavRow
                  icon="🔬"
                  label="Data & Research"
                  subtitle="Health data · research consent"
                  onPress={() => setScreen('data-research')}
                  last
                />
              </Group>

              {/* Group 6 — Support */}
              <Group label="Support">
                <NavRow
                  icon="💬"
                  label="Contact Us"
                  subtitle="Message the Niyama team"
                  onPress={() => router.push('/contact')}
                  badge={hasUnreadSupport ? 'New' : null}
                  last
                />
              </Group>

              {/* Group 7 — Legal */}
              <Group label="Legal">
                <NavRow
                  icon="⚖️"
                  label="Legal & Trust"
                  subtitle="Terms · Privacy · Cookie policy"
                  onPress={() => setScreen('legal')}
                  last
                />
              </Group>

              {/* Group 8 — Danger zone (no label) */}
              <Group label={null}>
                <NavRow
                  label="Sign Out"
                  onPress={handleSignOut}
                  danger
                  chevron={false}
                  icon={null}
                />
                <NavRow
                  label="Delete Account"
                  onPress={() => setDeleteStep(1)}
                  danger
                  chevron={false}
                  icon={null}
                  last
                />
              </Group>

              <Text style={s.footer}>Niyama Life Inc. · v1.0.0</Text>
            </>
          )}

          {/* ══════════════════════════════════════════
              MY HABITS
          ══════════════════════════════════════════ */}
          {screen === 'my-habits' && (
            <>
              {/* ── Section A: Wake Time ────────────────────── */}
              <Text style={[s.groupLabel, { marginTop: spacing.xl }]}>Wake Time</Text>
              <View style={[s.groupCard, { padding: spacing.lg }]}>
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.sm }}>
                  Your target wake time. Niyama verifies you woke within 30 minutes of this.
                </Text>
                <DateTimePicker
                  value={wakePickerTime}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => { if (date) setWakePickerTime(date); }}
                  themeVariant="light"
                  textColor={colors.textPrimary}
                />
                <Pressable
                  style={({ pressed }) => [{
                    backgroundColor: colors.primary, borderRadius: radius.md,
                    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
                    opacity: savingWakeTime || pressed ? 0.7 : 1,
                  }]}
                  onPress={saveWakeTime}
                  disabled={savingWakeTime}
                >
                  {savingWakeTime
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={{ fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#FFFFFF' }}>Save wake time</Text>
                  }
                </Pressable>
                {wakeTimeSaved && (
                  <Text style={{ fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.primary, textAlign: 'center', marginTop: spacing.md }}>
                    ✓ Wake time updated
                  </Text>
                )}
              </View>

              {/* ── Section B: Your 10 Habits (read-only) ────── */}
              <Text style={[s.groupLabel, { marginTop: spacing.lg }]}>Your 10 Habits</Text>
              <View style={s.groupCard}>
                {[
                  { icon: '🌅', label: 'Wake Consistency' },
                  { icon: '😴', label: 'Sleep Duration' },
                  { icon: '🚶', label: 'Steps / Activity' },
                  { icon: '📱', label: 'Screen Time' },
                  { icon: '🌙', label: 'No Phone after 10:30pm' },
                  { icon: '🧍', label: 'Stand Consistency' },
                  { icon: '☀️', label: 'Morning Sunlight' },
                  { icon: '🍽️', label: 'No Food after 8pm' },
                  { icon: '🧘', label: 'Recovery Practice' },
                  { icon: '🧠', label: 'Meditation' },
                ].map((h, i) => (
                  <View
                    key={h.label}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                      borderBottomWidth: i < 9 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 18, width: 28 }}>{h.icon}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 }}>
                      {h.label}
                    </Text>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: colors.primary + '22',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontFamily: fonts.bold }}>✓</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* ── Section C: Custom Habits ─────────────────── */}
              <Text style={[s.groupLabel, { marginTop: spacing.lg }]}>Custom Habits</Text>
              <View style={[s.habitSlotBanner, { marginTop: spacing.sm }]}>
                <Text style={s.habitSlotBannerText}>
                  {pointSlots === 0
                    ? 'Upgrade to Plus to earn points on custom habits'
                    : `${pointSlots} habit${pointSlots > 1 ? 's' : ''} earn points on ${tierConfig?.label}`
                  }
                </Text>
                {pointSlots > 0 && (
                  <View style={[s.slotBadge, { backgroundColor: (TIER_COLORS[tier] ?? colors.primary) + '18' }]}>
                    <Text style={[s.slotBadgeText, { color: TIER_COLORS[tier] ?? colors.primary }]}>
                      {Math.min(customHabits.length, pointSlots)}/{pointSlots} slots
                    </Text>
                  </View>
                )}
              </View>
              <View style={[s.groupCard, { marginTop: spacing.sm }]}>
                {customHabits.length === 0 ? (
                  <View style={s.emptyHabits}>
                    <Text style={s.emptyHabitsText}>No custom habits yet. Tap + Add to create one.</Text>
                  </View>
                ) : (
                  customHabits.map((h, i) => (
                    <Swipeable
                      key={h.id}
                      renderRightActions={() => (
                        <Pressable style={s.deleteAction} onPress={() => deleteCustomHabit(h.id)}>
                          <Text style={s.deleteActionText}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <View style={[s.habitItem, i === customHabits.length - 1 && { borderBottomWidth: 0 }]}>
                        <Text style={s.habitItemEmoji}>{h.emoji}</Text>
                        <Text style={s.habitItemName}>{h.name}</Text>
                        {i < pointSlots && (
                          <Text style={s.habitItemPts}>+{CUSTOM_HABIT_POINTS} pts</Text>
                        )}
                      </View>
                    </Swipeable>
                  ))
                )}
                <Pressable style={s.addHabitBtn} onPress={() => setAddHabitVisible(true)}>
                  <Text style={s.addHabitBtnText}>+ Add habit</Text>
                </Pressable>
              </View>
            </>
          )}


          {/* ══════════════════════════════════════════
              YOUR PLAN & REWARDS
          ══════════════════════════════════════════ */}
          {screen === 'plan-rewards' && (
            <SectionCard>
              <Row label="Current plan" value={tierConfig?.label ?? 'Free'} />
              <Row label="Base cap" value={`$${(tierConfig?.baseCap ?? 0).toFixed(2)}/mo`} />
              <Row label="Max monthly" value={`$${(tierConfig?.maxMonthly ?? 0).toFixed(2)}`} />
              {tier !== 'premium' && (
                <Pressable
                  style={({ pressed }) => [s.linkRow, s.lastRow, pressed && { opacity: 0.65 }]}
                  onPress={() => Linking.openURL('https://app.niyamalife.com')}
                >
                  <Text style={s.linkRowText}>Upgrade your plan →</Text>
                  <Text style={s.chevronRight}>›</Text>
                </Pressable>
              )}
            </SectionCard>
          )}

          {/* ══════════════════════════════════════════
              BILLING
          ══════════════════════════════════════════ */}
          {screen === 'billing' && (
            <SectionCard>
              <Pressable
                style={({ pressed }) => [s.linkRow, pressed && { opacity: 0.65 }]}
                onPress={() => Linking.openURL('https://app.niyamalife.com')}
              >
                <Text style={s.linkRowText}>Manage subscription</Text>
                <Text style={s.chevronRight}>›</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.linkRow, s.lastRow, pressed && { opacity: 0.65 }]}
                onPress={() => Linking.openURL('https://app.niyamalife.com')}
              >
                <Text style={s.linkRowText}>Billing history</Text>
                <Text style={s.chevronRight}>›</Text>
              </Pressable>
            </SectionCard>
          )}

          {/* ══════════════════════════════════════════
              HOW NIYAMA WORKS
          ══════════════════════════════════════════ */}
          {screen === 'how-niyama-works' && (
            <SectionCard>
              {HOW_IT_WORKS.map((item, i) => (
                <FaqRow
                  key={i}
                  question={item.q}
                  answer={item.a}
                  expanded={expandedFaq === i}
                  onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  last={i === HOW_IT_WORKS.length - 1}
                />
              ))}
            </SectionCard>
          )}


          {/* ══════════════════════════════════════════
              REFERRALS
          ══════════════════════════════════════════ */}
          {screen === 'referrals' && (
            <>
              {/* Brand card */}
              <View style={[s.sectionCard, { alignItems: 'center', paddingVertical: spacing.xxl }]}>
                <NiyamaIcon size={64} showBackground />
                <Text style={{ fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, marginTop: spacing.md }}>
                  Niyama Life
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 2 }}>
                  Rewarding Discipline.
                </Text>
              </View>

              {profile?.referral_code ? (
                <>
                  {/* Referral code box */}
                  <Pressable
                    style={({ pressed }) => [s.sectionCard, {
                      alignItems: 'center', paddingVertical: spacing.xl,
                      opacity: pressed ? 0.75 : 1,
                    }]}
                    onPress={copyReferralCode}
                  >
                    <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.xs, color: referralCopied ? colors.primary : colors.textMuted, marginBottom: spacing.sm }}>
                      {referralCopied ? '✓ Copied!' : 'Tap to copy'}
                    </Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 34, color: colors.primary, letterSpacing: 5 }}>
                      {profile.referral_code}
                    </Text>
                  </Pressable>

                  {/* Share button */}
                  <Pressable
                    style={({ pressed }) => [{
                      backgroundColor: colors.primary, borderRadius: radius.md,
                      paddingVertical: 16, alignItems: 'center',
                      opacity: pressed ? 0.75 : 1,
                    }]}
                    onPress={() => Share.share({
                      message: `Join me on Niyama Life and get rewarded for your daily habits! Use my referral code: ${profile.referral_code} — download at https://niyamalife.com`,
                    })}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' }}>
                      Share your referral link
                    </Text>
                  </Pressable>

                  {/* Benefit card */}
                  <InfoCard tinted>
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary, textAlign: 'center', lineHeight: 22 }}>
                      Give a friend $5, earn $5 when they complete their first 30 days on any paid plan.
                    </Text>
                  </InfoCard>

                  {/* Stats row */}
                  <View style={[s.sectionCard, { flexDirection: 'row', paddingVertical: 0 }]}>
                    <View style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.lg }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.primary }}>
                        {profile?.referral_count ?? 0}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 }}>
                        Friends invited
                      </Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <View style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.lg }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.primary }}>
                        ${(profile?.referral_cap_bonus ?? 0).toFixed(2)}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 }}>
                        Earned
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <InfoCard>
                  <Text style={s.infoText}>
                    Your referral code is being generated. Check back soon!
                  </Text>
                </InfoCard>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════
              DATA & RESEARCH
          ══════════════════════════════════════════ */}
          {screen === 'data-research' && (
            <>
              <InfoCard>
                <Text style={s.infoText}>
                  Niyama Life reads health data from Apple Health including steps, sleep, heart rate, HRV, mindful minutes, and more to automatically verify your daily habits and build your personal health dashboard. Your raw health data never leaves your device — only anonymised, aggregated insights are used for habit scoring. If you consent below, anonymised data may contribute to independent health research studies.
                </Text>
              </InfoCard>

              <SectionCard style={{ marginTop: spacing.lg }}>
                <View style={s.toggleRow}>
                  <View style={s.toggleLeft}>
                    <Text style={s.toggleLabel}>Research consent</Text>
                    <Text style={s.toggleSub}>Allow anonymised data to support health research</Text>
                  </View>
                  <Switch
                    value={researchConsent}
                    onValueChange={toggleResearchConsent}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.card}
                    disabled={savingConsent}
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [s.linkRow, pressed && { opacity: 0.65 }]}
                  onPress={() => Alert.alert(
                    'Manage Apple Health Permissions',
                    'To manage Apple Health permissions, go to Settings → Privacy & Security → Health → Niyama Life',
                    [{ text: 'OK' }],
                  )}
                >
                  <Text style={s.linkRowText}>Disconnect Apple Health</Text>
                  <Text style={s.chevronRight}>›</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.linkRow, s.lastRow, pressed && { opacity: 0.65 }]}
                  onPress={() => Linking.openURL('mailto:admin@niyamalife.com?subject=Data%20Export%20Request')}
                >
                  <Text style={s.linkRowText}>Export my data</Text>
                  <Text style={s.chevronRight}>›</Text>
                </Pressable>
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════════
              LEGAL & TRUST
          ══════════════════════════════════════════ */}
          {screen === 'legal' && (
            <SectionCard>
              {[
                { label: 'Terms of Service',   url: 'https://www.niyamalife.com/terms'   },
                { label: 'Privacy Policy',      url: 'https://www.niyamalife.com/privacy' },
                { label: 'Cookie Policy',       url: 'https://www.niyamalife.com/privacy' },
                { label: 'Age & Minor Policy',  url: 'https://www.niyamalife.com/terms'   },
              ].map(({ label, url }, i, arr) => (
                <Pressable
                  key={label}
                  style={({ pressed }) => [s.linkRow, i === arr.length - 1 && s.lastRow, pressed && { opacity: 0.65 }]}
                  onPress={() => Linking.openURL(url)}
                >
                  <Text style={s.linkRowText}>{label}</Text>
                  <Text style={s.chevronRight}>›</Text>
                </Pressable>
              ))}
            </SectionCard>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ─────────────────────────────────────────────
            MODALS — always in root component tree
        ───────────────────────────────────────────── */}

        {/* Edit Profile */}
        <Modal
          visible={editProfileVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditProfileVisible(false)}
        >
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => setEditProfileVisible(false)}>
                  <Text style={s.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={s.modalTitle}>Edit Profile</Text>
                <Pressable onPress={saveProfile} disabled={savingProfile}>
                  {savingProfile
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={s.modalSave}>Save</Text>
                  }
                </Pressable>
              </View>
              <View style={s.modalBody}>
                <Text style={s.fieldLabel}>Full name</Text>
                <TextInput
                  style={s.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveProfile}
                />
                <Text style={s.fieldNote}>
                  Email and phone changes require contacting support@niyamalife.com
                </Text>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Custom Habit */}
        <Modal
          visible={addHabitVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAddHabitVisible(false)}
        >
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => setAddHabitVisible(false)}>
                  <Text style={s.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={s.modalTitle}>Add Habit</Text>
                <Pressable onPress={addCustomHabit} disabled={savingHabit || !newHabitName.trim()}>
                  {savingHabit
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={[s.modalSave, !newHabitName.trim() && { opacity: 0.4 }]}>Save</Text>
                  }
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={s.modalBody}>
                <Text style={s.fieldLabel}>Habit name</Text>
                <TextInput
                  style={s.fieldInput}
                  value={newHabitName}
                  onChangeText={setNewHabitName}
                  placeholder="e.g. Cold shower"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="done"
                />
                <Text style={[s.fieldLabel, { marginTop: spacing.lg }]}>Choose emoji</Text>
                <View style={s.emojiGrid}>
                  {EMOJI_LIST.map(em => (
                    <Pressable
                      key={em}
                      onPress={() => setNewHabitEmoji(em)}
                      style={[s.emojiCell, newHabitEmoji === em && s.emojiCellSelected]}
                    >
                      <Text style={s.emojiText}>{em}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete Account — Step 1: Warning */}
        <Modal
          visible={deleteStep === 1}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDeleteStep(0)}
        >
          <SafeAreaView style={s.modalSafe}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setDeleteStep(0)}>
                <Text style={s.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={s.modalTitle}>Delete Account</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={s.modalBody}>
              <Text style={s.deleteEmoji}>⚠️</Text>
              <Text style={s.deleteWarningTitle}>This cannot be undone</Text>
              <Text style={s.deleteWarningBody}>
                Deleting your account will permanently remove:{'\n\n'}
                • All your habit logs and history{'\n'}
                • Your points and rewards balance{'\n'}
                • Your streak and milestones{'\n'}
                • Your profile and preferences{'\n\n'}
                Any unclaimed reward balance will be forfeited.
              </Text>
              <Pressable style={s.deleteConfirmBtn} onPress={() => setDeleteStep(2)}>
                <Text style={s.deleteConfirmBtnText}>I understand, continue</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Delete Account — Step 2: Type DELETE */}
        <Modal
          visible={deleteStep === 2}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDeleteStep(0)}
        >
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => { setDeleteStep(0); setDeleteInput(''); }}>
                  <Text style={s.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={s.modalTitle}>Confirm Deletion</Text>
                <View style={{ width: 60 }} />
              </View>
              <View style={s.modalBody}>
                <Text style={s.deleteConfirmLabel}>
                  Type <Text style={s.deleteWord}>DELETE</Text> to confirm
                </Text>
                <TextInput
                  style={[s.fieldInput, s.deleteInput]}
                  value={deleteInput}
                  onChangeText={setDeleteInput}
                  placeholder="DELETE"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
                <Pressable
                  style={[s.deleteConfirmBtn, deleteInput.trim() !== 'DELETE' && { opacity: 0.4 }]}
                  onPress={handleDeleteAccount}
                  disabled={deleteInput.trim() !== 'DELETE'}
                >
                  <Text style={s.deleteConfirmBtnText}>Delete my account permanently</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete Account — Step 3: Deleting spinner */}
        <Modal visible={deleteStep === 3} animationType="fade" transparent>
          <View style={s.spinnerOverlay}>
            <ActivityIndicator color={colors.card} size="large" />
            <Text style={s.spinnerText}>Deleting account…</Text>
          </View>
        </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  screenTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  backBtn: { padding: spacing.xs },
  backArrow: {
    fontFamily: fonts.regular,
    fontSize: 34,
    color: colors.primary,
    lineHeight: 38,
    marginTop: -3,
  },
  subTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  profileInitials: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  profileEmail: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  profileMeta: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  tierPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  tierPillText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },

  // ── Groups ──
  group: { marginTop: spacing.lg },
  groupLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  // ── Nav rows ──
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 58,
  },
  lastRow: { borderBottomWidth: 0 },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  navIconDanger: { backgroundColor: colors.secondary + '18' },
  navIconEmoji: { fontSize: 17 },
  navRowCenter: { flex: 1 },
  navRowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navRowLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  navRowDanger: { color: colors.secondary },
  navRowSub: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    lineHeight: 26,
    marginLeft: spacing.sm,
  },
  navBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  navBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  navRowRight: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  connectedLabel: {
    color: colors.primary,
  },
  connectLabel: {
    color: '#FFFFFF',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },

  // ── Footer ──
  footer: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },

  // ── Section card (sub-screen content) ──
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginTop: spacing.xl,
  },

  // ── Info card ──
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginTop: spacing.xl,
  },
  infoCardTinted: {
    backgroundColor: colors.primaryLight,
  },
  infoCardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ── My Habits sub-screen ──
  habitStructureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  habitStructureIcon: {
    fontSize: 18,
    marginRight: spacing.md,
    marginTop: 1,
    flexShrink: 0,
  },
  habitStructureLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.primary,
    marginBottom: 2,
  },
  habitStructureDesc: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // ── Key-value rows (sub-screens) ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  rowValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'right',
    maxWidth: '55%',
  },
  codeValue: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
    letterSpacing: 1,
  },
  comingSoon: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkRowText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  chevronRight: {
    fontSize: 20,
    color: colors.textMuted,
    lineHeight: 22,
  },

  // ── FAQ ──
  faqRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.md,
  },
  faqChevron: { fontSize: 10, color: colors.textMuted },
  faqAnswer: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  // ── Custom habits sub-screen ──
  habitSlotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.xl,
  },
  habitSlotBannerText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    flex: 1,
  },
  slotBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  slotBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },
  emptyHabits: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyHabitsText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textMuted,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  habitItemEmoji: { fontSize: 20, marginRight: spacing.md },
  habitItemName: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  habitItemPts: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  deleteAction: {
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  deleteActionText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#FFFFFF',
  },
  addHabitBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addHabitBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.primary,
  },

  // ── Toggle (Data & Research) ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLeft: { flex: 1, marginRight: spacing.md },
  toggleLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  toggleSub: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Modals ──
  modalWrap: { flex: 1, backgroundColor: colors.background },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  modalCancel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    minWidth: 60,
  },
  modalSave: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.primary,
    minWidth: 60,
    textAlign: 'right',
  },
  modalBody: { padding: spacing.xl },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  fieldNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emojiCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiCellSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  emojiText: { fontSize: 24 },

  // ── Delete flow ──
  deleteEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  deleteWarningTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  deleteWarningBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  deleteConfirmBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deleteConfirmBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#FFFFFF',
  },
  deleteConfirmLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  deleteWord: { fontFamily: fonts.bold, color: colors.error },
  deleteInput: {
    fontFamily: fonts.bold,
    letterSpacing: 2,
    color: colors.error,
    borderColor: colors.error + '40',
  },
  spinnerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  spinnerText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.card,
    marginTop: spacing.md,
  },
});
