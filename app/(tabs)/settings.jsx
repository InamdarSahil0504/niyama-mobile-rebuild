import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Switch,
  Modal, TextInput, Alert, ActivityIndicator, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, router } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import { TIERS, DB, isMinorUser, CUSTOM_HABIT_POINTS } from '../../src/config';

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
  'custom-habits':    'Custom Habits',
  'plan-rewards':     'Your Plan & Rewards',
  'billing':          'Billing',
  'how-niyama-works': 'How Niyama Works',
  'preferences':      'Preferences',
  'referrals':        'Referrals',
  'data-research':    'Data & Research',
  'legal':            'Legal & Trust',
};

// ─── Shared sub-components ──────────────────────────────────────────────────

function NavRow({ icon, label, subtitle, onPress, chevron = true, danger = false, badge, last }) {
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
      {chevron && !danger && <Text style={s.chevron}>›</Text>}
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

  useFocusEffect(
    useCallback(() => {
      loadCustomHabits();
      checkUnreadSupport();
      if (profile) {
        setEditName(profile.full_name ?? '');
        setResearchConsent(profile.research_consent ?? true);
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
      await refreshProfile();
    } catch (_) {
      setResearchConsent(!val);
    } finally {
      setSavingConsent(false);
    }
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
                  subtitle="Wake time · habit structure"
                  onPress={() => setScreen('my-habits')}
                />
                <NavRow
                  icon="⭐"
                  label="Custom Habits"
                  subtitle={`${customHabits.length} active habit${customHabits.length !== 1 ? 's' : ''}`}
                  onPress={() => setScreen('custom-habits')}
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

              {/* Group 3 — Learn */}
              <Group label="Learn">
                <NavRow
                  icon="📖"
                  label="How Niyama Works"
                  subtitle="Points, rewards, successful days"
                  onPress={() => setScreen('how-niyama-works')}
                  last
                />
              </Group>

              {/* Group 4 — Account */}
              <Group label="Account">
                <NavRow
                  icon="🔔"
                  label="Preferences"
                  subtitle="Wake time · HealthKit"
                  onPress={() => setScreen('preferences')}
                />
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

              {/* Group 5 — Support */}
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

              {/* Group 6 — Legal */}
              <Group label="Legal">
                <NavRow
                  icon="⚖️"
                  label="Legal & Trust"
                  subtitle="Terms · Privacy · Cookie policy"
                  onPress={() => setScreen('legal')}
                  last
                />
              </Group>

              {/* Group 7 — Danger zone (no label) */}
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
              <InfoCard tinted>
                <Text style={s.infoCardTitle}>Phase 6 habit structure</Text>
                {[
                  { icon: '🌅', label: '3 Core habits', desc: 'Wake Consistency, Sleep Duration, Steps — auto-verified via Apple Health.' },
                  { icon: '📚', label: '7 Library habits', desc: 'Screen Time, No Phone, Stand, Sunlight, No Late Food, Recovery, Meditation — fixed for everyone.' },
                  { icon: '⭐', label: 'Custom habits', desc: 'Add personal habits to track. Manage them under Custom Habits.' },
                ].map((item, i) => (
                  <View key={i} style={[s.habitStructureRow, i > 0 && { marginTop: spacing.md }]}>
                    <Text style={s.habitStructureIcon}>{item.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.habitStructureLabel}>{item.label}</Text>
                      <Text style={s.habitStructureDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </InfoCard>

              <SectionCard style={{ marginTop: spacing.lg }}>
                <Row label="Core habits" value="3" />
                <Row label="Library habits" value="7" />
                <Row label="Core habit points" value="100 pts each" />
                <Row label="Library habit points" value="50 pts each" />
                <Row label="Successful day bonus" value="+50 pts" />
                <Row label="Perfect day bonus" value="+100 pts" last />
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════════
              CUSTOM HABITS
          ══════════════════════════════════════════ */}
          {screen === 'custom-habits' && (
            <>
              <View style={s.habitSlotBanner}>
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

              <SectionCard style={{ marginTop: spacing.sm }}>
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
              </SectionCard>
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
                <View style={[s.linkRow, s.lastRow]}>
                  <Text style={s.linkRowText}>Upgrade your plan</Text>
                  <Text style={s.comingSoon}>Coming soon</Text>
                </View>
              )}
            </SectionCard>
          )}

          {/* ══════════════════════════════════════════
              BILLING
          ══════════════════════════════════════════ */}
          {screen === 'billing' && (
            <SectionCard>
              <View style={s.linkRow}>
                <Text style={s.linkRowText}>Manage subscription</Text>
                <Text style={s.comingSoon}>Coming soon</Text>
              </View>
              <View style={[s.linkRow, s.lastRow]}>
                <Text style={s.linkRowText}>Billing history</Text>
                <Text style={s.comingSoon}>Coming soon</Text>
              </View>
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
              PREFERENCES
          ══════════════════════════════════════════ */}
          {screen === 'preferences' && (
            <SectionCard>
              <Row label="Wake time" value={profile?.wake_time ? formatTime(profile.wake_time) : '—'} />
              <Row label="HealthKit" value={profile?.healthkit_connected ? 'Connected' : 'Not connected'} last />
            </SectionCard>
          )}

          {/* ══════════════════════════════════════════
              REFERRALS
          ══════════════════════════════════════════ */}
          {screen === 'referrals' && (
            <SectionCard>
              {profile?.referral_code ? (
                <>
                  <Row label="Your code" value={profile.referral_code} valueStyle={s.codeValue} />
                  <Pressable style={[s.linkRow, s.lastRow]} onPress={shareReferral}>
                    <Text style={s.linkRowText}>Share referral link</Text>
                    <Text style={s.chevronRight}>›</Text>
                  </Pressable>
                </>
              ) : (
                <Row label="Referral code" value="Coming soon" last />
              )}
            </SectionCard>
          )}

          {/* ══════════════════════════════════════════
              DATA & RESEARCH
          ══════════════════════════════════════════ */}
          {screen === 'data-research' && (
            <>
              <InfoCard>
                <Text style={s.infoText}>
                  Niyama reads the following from Apple Health: step count, sleep duration, stand hours, and resting heart rate. Your raw health data never leaves your device — only anonymised, aggregated insights are used for habit scoring. If you consent below, anonymised data may contribute to independent health research studies.
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
                <View style={s.linkRow}>
                  <Text style={s.linkRowText}>Disconnect Apple Health</Text>
                  <Text style={s.comingSoon}>Coming soon</Text>
                </View>
                <View style={[s.linkRow, s.lastRow]}>
                  <Text style={s.linkRowText}>Export my data</Text>
                  <Text style={s.comingSoon}>Coming soon</Text>
                </View>
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════════
              LEGAL & TRUST
          ══════════════════════════════════════════ */}
          {screen === 'legal' && (
            <SectionCard>
              {['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Age & Minor Policy'].map((label, i, arr) => (
                <View key={label} style={[s.linkRow, i === arr.length - 1 && s.lastRow]}>
                  <Text style={s.linkRowText}>{label}</Text>
                  <Text style={s.comingSoon}>Coming soon</Text>
                </View>
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
