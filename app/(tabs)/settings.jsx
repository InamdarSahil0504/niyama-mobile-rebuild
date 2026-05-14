import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Switch,
  Modal, TextInput, Alert, ActivityIndicator, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, router } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import { TIERS, DB, isMinorUser, CUSTOM_HABIT_POINTS } from '../../src/config';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const TIER_COLORS = {
  free:    colors.textMuted,
  basic:   '#7A8FA6',
  plus:    colors.primary,
  premium: colors.accent,
};

const HOW_IT_WORKS = [
  { q: 'How are points calculated?', a: 'You earn points for each habit you complete. Core habits (wake, sleep, steps) use HealthKit data. Library habits use the honour system or photo confirmations. A Successful Day bonus (+50 pts) applies when you hit 2+ core and 3+ library habits. A Perfect Day bonus (+100 pts) applies when you complete all 10.' },
  { q: 'How do rewards work?', a: 'Every 1,000 points = $1.00 of reward value. At the end of each month, your points convert to a dollar amount up to your tier cap. Redeem as gift cards once your account is 30+ days old.' },
  { q: 'What are milestone bonuses?', a: 'Plus and Premium members unlock milestone bonuses on top of the base cap. Only the highest milestone you reach in a month applies (OR logic). Requires 60+ days on the platform.' },
  { q: 'How does HealthKit verification work?', a: 'For HealthKit-verified habits, Niyama reads your Apple Health data. There\'s a 2–3 second verification window after you check a habit. You never lose points — if HealthKit data is unavailable, the check still counts.' },
  { q: 'What is a Perfect Day?', a: 'All 10 habits completed (3 core + 7 library). Custom habits are excluded from this threshold but still earn points.' },
];

const EMOJI_LIST = [
  '💪','🏃','🧘','🌿','💧','📚','🎯','🌅','🥗','😴',
  '🚶','🍎','☕','🎵','🌸','🏋️','🚴','🧠','❤️','✍️',
  '🌊','🎨','🔥','⭐','🌙','🦋','🎸','🌺','🧩','🕯️',
];

// --------------------------------------------------------------------------
// Main screen
// --------------------------------------------------------------------------

export default function SettingsTab() {
  const { session, profile, refreshProfile } = useAuth();
  const [customHabits, setCustomHabits] = useState([]);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  // Edit profile
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Add custom habit modal
  const [addHabitVisible, setAddHabitVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('💪');
  const [savingHabit, setSavingHabit] = useState(false);

  // Delete account (4 steps)
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
      .order('created_at', { ascending: true });
    if (!error) setCustomHabits(data ?? []);
  }

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

  async function addCustomHabit() {
    if (!newHabitName.trim()) return;
    setSavingHabit(true);
    try {
      const { error } = await supabase.from('custom_habits').insert({
        user_id: session.user.id,
        name: newHabitName.trim(),
        emoji: newHabitEmoji,
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
      const { error } = await supabase.from('custom_habits').delete().eq('id', id);
      if (error) throw error;
      setCustomHabits(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not delete habit.');
    }
  }

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

  const tier = profile?.tier ?? 'free';
  const tierConfig = TIERS[tier];
  const isMinor = isMinorUser(profile?.date_of_birth);
  const email = session?.user?.email ?? '';
  const name = profile?.full_name ?? '';
  const accountCreated = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const pointSlots = TIERS[tier]?.customHabitPointSlots ?? 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <Text style={s.screenTitle}>Settings</Text>

          {/* ── 1. My Profile ─────────────────────────── */}
          <Section title="My Profile">
            <View style={s.profileCard}>
              <View style={s.profileAvatar}>
                <Text style={s.profileInitials}>
                  {name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'N'}
                </Text>
              </View>
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{name || 'Your Name'}</Text>
                <Text style={s.profileEmail}>{email}</Text>
                {accountCreated ? <Text style={s.profileMeta}>Member since {accountCreated}</Text> : null}
              </View>
              <Pressable onPress={() => { setEditName(profile?.full_name ?? ''); setEditProfileVisible(true); }} style={s.editBtn}>
                <Text style={s.editBtnText}>Edit</Text>
              </Pressable>
            </View>
            <Row label="Tier" value={
              <View style={[s.tierPill, { backgroundColor: (TIER_COLORS[tier] ?? colors.primary) + '18' }]}>
                <Text style={[s.tierPillText, { color: TIER_COLORS[tier] ?? colors.primary }]}>{tierConfig?.label ?? 'Free'}</Text>
              </View>
            } />
            <Row label="Region" value={profile?.region ?? '—'} last />
          </Section>

          {/* ── 2. Custom Habits ──────────────────────── */}
          <Section title="Custom Habits">
            {/* Tier badge */}
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
          </Section>

          {/* ── 3. How Niyama Works ───────────────────── */}
          <Section title="How Niyama Works">
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
          </Section>

          {/* ── 4. Your Plan & Rewards ────────────────── */}
          <Section title="Your Plan & Rewards">
            <Row label="Current plan" value={tierConfig?.label ?? 'Free'} />
            <Row label="Base cap" value={`$${(tierConfig?.baseCap ?? 0).toFixed(2)}/mo`} />
            <Row label="Max monthly" value={`$${(tierConfig?.maxMonthly ?? 0).toFixed(2)}`} />
            {tier !== 'premium' && (
              <View style={[s.linkRow, s.lastRow]}>
                <Text style={s.linkRowText}>Upgrade your plan</Text>
                <Text style={s.comingSoon}>Coming soon</Text>
              </View>
            )}
          </Section>

          {/* ── 5. Referrals (hidden for minors) ─────── */}
          {!isMinor && (
            <Section title="Referrals">
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
            </Section>
          )}

          {/* ── 6. Billing ────────────────────────────── */}
          <Section title="Billing">
            <View style={s.linkRow}>
              <Text style={s.linkRowText}>Manage subscription</Text>
              <Text style={s.comingSoon}>Coming soon</Text>
            </View>
            <View style={[s.linkRow, s.lastRow]}>
              <Text style={s.linkRowText}>Billing history</Text>
              <Text style={s.comingSoon}>Coming soon</Text>
            </View>
          </Section>

          {/* ── 7. Preferences ────────────────────────── */}
          <Section title="Preferences">
            <Row label="Wake time" value={profile?.wake_time ? formatTime(profile.wake_time) : '—'} />
            <Row label="HealthKit" value={profile?.healthkit_connected ? 'Connected' : 'Not connected'} last />
          </Section>

          {/* ── 7.5. Contact Us ───────────────────────── */}
          <Section title="Contact Us">
            <Pressable style={[s.linkRow, s.lastRow]} onPress={() => router.push('/contact')}>
              <Text style={s.linkRowText}>Message Niyama Support</Text>
              <View style={s.contactRowRight}>
                {hasUnreadSupport && <View style={s.unreadDot} />}
                <Text style={s.chevronRight}>›</Text>
              </View>
            </Pressable>
          </Section>

          {/* ── 8. Data & Research ────────────────────── */}
          <Section title="Data & Research">
            <View style={s.infoBlock}>
              <Text style={s.infoText}>
                Niyama reads the following from Apple Health: step count, sleep duration, stand hours, and resting heart rate. Your raw health data never leaves your device — only anonymised, aggregated insights are used for habit scoring. If you consent below, anonymised data may contribute to independent health research studies.
              </Text>
            </View>
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
          </Section>

          {/* ── 9. Legal & Trust ──────────────────────── */}
          <Section title="Legal & Trust">
            {['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Age & Minor Policy'].map((label, i, arr) => (
              <View key={label} style={[s.linkRow, i === arr.length - 1 && s.lastRow]}>
                <Text style={s.linkRowText}>{label}</Text>
                <Text style={s.comingSoon}>Coming soon</Text>
              </View>
            ))}
          </Section>

          {/* ── 10. Account ───────────────────────────── */}
          <Section title="Account">
            <Pressable style={s.linkRow} onPress={handleSignOut}>
              <Text style={[s.linkRowText, s.signOutText]}>Sign out</Text>
            </Pressable>
            <Pressable style={[s.linkRow, s.lastRow]} onPress={() => setDeleteStep(1)}>
              <Text style={[s.linkRowText, s.deleteText]}>Delete account</Text>
            </Pressable>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Edit Profile Modal ─────────────────────── */}
        <Modal visible={editProfileVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditProfileVisible(false)}>
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => setEditProfileVisible(false)}><Text style={s.modalCancel}>Cancel</Text></Pressable>
                <Text style={s.modalTitle}>Edit Profile</Text>
                <Pressable onPress={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <ActivityIndicator color={colors.primary} /> : <Text style={s.modalSave}>Save</Text>}
                </Pressable>
              </View>
              <View style={s.modalBody}>
                <Text style={s.fieldLabel}>Full name</Text>
                <TextInput
                  style={s.fieldInput} value={editName} onChangeText={setEditName}
                  placeholder="Your full name" placeholderTextColor={colors.textMuted}
                  autoFocus returnKeyType="done" onSubmitEditing={saveProfile}
                />
                <Text style={s.fieldNote}>Email and phone changes require contacting support@niyamalife.com</Text>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Add Custom Habit Modal ─────────────────── */}
        <Modal visible={addHabitVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddHabitVisible(false)}>
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => setAddHabitVisible(false)}><Text style={s.modalCancel}>Cancel</Text></Pressable>
                <Text style={s.modalTitle}>Add Habit</Text>
                <Pressable onPress={addCustomHabit} disabled={savingHabit || !newHabitName.trim()}>
                  {savingHabit ? <ActivityIndicator color={colors.primary} /> : (
                    <Text style={[s.modalSave, !newHabitName.trim() && { opacity: 0.4 }]}>Save</Text>
                  )}
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={s.modalBody}>
                <Text style={s.fieldLabel}>Habit name</Text>
                <TextInput
                  style={s.fieldInput} value={newHabitName} onChangeText={setNewHabitName}
                  placeholder="e.g. Cold shower" placeholderTextColor={colors.textMuted}
                  autoFocus returnKeyType="done"
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

        {/* ── Delete Account — Step 1: Warning ──────── */}
        <Modal visible={deleteStep === 1} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDeleteStep(0)}>
          <SafeAreaView style={s.modalSafe}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setDeleteStep(0)}><Text style={s.modalCancel}>Cancel</Text></Pressable>
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

        {/* ── Delete Account — Step 2: Type DELETE ──── */}
        <Modal visible={deleteStep === 2} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDeleteStep(0)}>
          <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={s.modalSafe}>
              <View style={s.modalHeader}>
                <Pressable onPress={() => { setDeleteStep(0); setDeleteInput(''); }}><Text style={s.modalCancel}>Cancel</Text></Pressable>
                <Text style={s.modalTitle}>Confirm Deletion</Text>
                <View style={{ width: 60 }} />
              </View>
              <View style={s.modalBody}>
                <Text style={s.deleteConfirmLabel}>
                  Type <Text style={s.deleteWord}>DELETE</Text> to confirm
                </Text>
                <TextInput
                  style={[s.fieldInput, s.deleteInput]} value={deleteInput} onChangeText={setDeleteInput}
                  placeholder="DELETE" placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters" autoCorrect={false} autoFocus
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

        {/* ── Delete Account — Step 3: Deleting ─────── */}
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

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
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

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl },

  screenTitle: {
    fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary,
    marginTop: spacing.md, marginBottom: spacing.lg,
  },

  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fonts.semiBold, fontSize: fontSizes.xs, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.sm, marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },

  // Rows
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  rowValue: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'right', maxWidth: '55%' },
  codeValue: { fontFamily: fonts.semiBold, color: colors.primary, letterSpacing: 1 },
  comingSoon: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },

  // Link rows
  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  linkRowText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary },
  chevronRight: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  contactRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  signOutText: { color: colors.secondary },
  deleteText: { color: colors.error },

  // Profile
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  profileInitials: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  profileEmail: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  profileMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  editBtnText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.primary },

  // Tier pill
  tierPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  tierPillText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm },

  // Custom habits
  habitSlotBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  habitSlotBannerText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.primary, flex: 1 },
  slotBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing.sm },
  slotBadgeText: { fontFamily: fonts.semiBold, fontSize: fontSizes.xs },
  emptyHabits: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyHabitsText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted },
  habitItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  habitItemEmoji: { fontSize: 20, marginRight: spacing.md },
  habitItemName: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  habitItemPts: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.primary },
  deleteAction: {
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  deleteActionText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: '#FFFFFF' },
  addHabitBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  addHabitBtnText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },

  // Info block (Data & Research explanation)
  infoBlock: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  infoText: {
    fontFamily: fonts.regular, fontSize: fontSizes.sm,
    color: colors.textSecondary, lineHeight: 20,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  toggleLeft: { flex: 1, marginRight: spacing.md },
  toggleLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary },
  toggleSub: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },

  // FAQ
  faqRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1, paddingRight: spacing.md },
  faqChevron: { fontSize: 10, color: colors.textMuted },
  faqAnswer: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },

  // Modals
  modalWrap: { flex: 1, backgroundColor: colors.background },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  modalCancel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, minWidth: 60 },
  modalSave: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary, minWidth: 60, textAlign: 'right' },
  modalBody: { padding: spacing.xl },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  fieldNote: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },

  // Emoji picker
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  emojiCell: {
    width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  emojiCellSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emojiText: { fontSize: 24 },

  // Delete flow
  deleteEmoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.lg, marginTop: spacing.lg },
  deleteWarningTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.lg },
  deleteWarningBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.xxl },
  deleteConfirmBtn: { backgroundColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  deleteConfirmBtnText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: '#FFFFFF' },
  deleteConfirmLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.md, marginTop: spacing.xl },
  deleteWord: { fontFamily: fonts.bold, color: colors.error },
  deleteInput: { fontFamily: fonts.bold, letterSpacing: 2, color: colors.error, borderColor: colors.error + '40' },

  // Spinner
  spinnerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  spinnerText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.card, marginTop: spacing.md },
});
