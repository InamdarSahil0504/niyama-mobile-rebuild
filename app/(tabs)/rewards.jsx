import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { sendGiftCardNotification } from '../../src/notifications';
import { supabase } from '../../src/supabase';
import {
  TIERS, MILESTONE_DEFINITIONS, GIFT_CARD_BRANDS, POINTS_PER_DOLLAR,
  canRedeemBaseCap, canRedeemMilestoneBonuses, isFreeRewardExpired,
  calculateMonthMilestoneBonus,
} from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntilPayout() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((next - now) / 86400000);
}

function accountAgeDays(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

function unlockDateLabel(createdAt, daysNeeded) {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + daysNeeded);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysRemainingUntil(createdAt, daysNeeded) {
  const age = accountAgeDays(createdAt);
  return Math.max(0, daysNeeded - age);
}

function daysInCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function currentMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Gift Card Modal ──────────────────────────────────────────────────────────

function GiftCardModal({ visible, balance, onClose, onRedeem }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    if (!selected) return;
    setLoading(true);
    try {
      await onRedeem(selected);
      setSelected(null);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gcStyles.safe}>
        <View style={gcStyles.header}>
          <Text style={gcStyles.title}>Choose your gift card</Text>
          <Pressable onPress={onClose} style={gcStyles.closeBtn}>
            <Text style={gcStyles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={gcStyles.balanceRow}>
          <Text style={gcStyles.balanceLabel}>Available to redeem</Text>
          <Text style={gcStyles.balanceAmount}>${balance.toFixed(2)}</Text>
        </View>

        <ScrollView contentContainerStyle={gcStyles.grid} showsVerticalScrollIndicator={false}>
          {GIFT_CARD_BRANDS.map(brand => (
            <Pressable
              key={brand}
              style={[gcStyles.brandCard, selected === brand && gcStyles.brandCardSelected]}
              onPress={() => setSelected(brand)}
            >
              <Text style={gcStyles.brandEmoji}>🎁</Text>
              <Text style={[gcStyles.brandName, selected === brand && gcStyles.brandNameSelected]}>
                {brand}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={gcStyles.footer}>
          <Pressable
            style={[gcStyles.redeemBtn, (!selected || loading) && gcStyles.redeemBtnDisabled]}
            onPress={handleRedeem}
            disabled={!selected || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={gcStyles.redeemBtnText}>
                  Redeem ${balance.toFixed(2)} as {selected ?? 'gift card'}
                </Text>
            }
          </Pressable>
          <Text style={gcStyles.footerNote}>
            Gift cards are delivered via email within 24 hours. Powered by Tremendous.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const gcStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary },
  closeBtn: { padding: spacing.sm },
  closeText: { fontFamily: fonts.medium, fontSize: fontSizes.lg, color: colors.textMuted },
  balanceRow: { alignItems: 'center', paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  balanceLabel: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: 4 },
  balanceAmount: { fontFamily: fonts.bold, fontSize: 48, color: colors.primary, lineHeight: 52 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.xl, gap: spacing.md },
  brandCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  brandCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  brandEmoji: { fontSize: 28 },
  brandName: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textPrimary, textAlign: 'center' },
  brandNameSelected: { color: colors.primary, fontFamily: fonts.semiBold },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  redeemBtn: { backgroundColor: colors.secondary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  redeemBtnDisabled: { opacity: 0.5 },
  redeemBtnText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
  footerNote: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});

// ─── Milestone Row ────────────────────────────────────────────────────────────

function MilestoneRow({ definition, tier, successfulDays, perfectDays, totalDays, canClaimMilestones, isHighestActive }) {
  const bonus = definition.tiers[tier];
  if (!bonus) return null; // this milestone doesn't apply to this tier

  let progress = 0, required = 0, label = '';
  if (definition.key === 'successfulDays10') { required = 10; progress = Math.min(successfulDays, 10); label = '10 Successful Days'; }
  else if (definition.key === 'successfulDays20') { required = 20; progress = Math.min(successfulDays, 20); label = '20 Successful Days'; }
  else if (definition.key === 'successfulMonth') { required = totalDays; progress = Math.min(successfulDays, totalDays); label = 'Successful Month'; }
  else if (definition.key === 'perfectMonth') { required = totalDays; progress = Math.min(perfectDays, totalDays); label = 'Perfect Month'; }

  const pct = required ? Math.round((progress / required) * 100) : 0;
  const achieved = progress >= required;
  const locked = !canClaimMilestones;

  return (
    <View style={[msStyles.row, achieved && isHighestActive && msStyles.rowActive, locked && msStyles.rowLocked]}>
      <View style={msStyles.left}>
        <View style={[msStyles.dot, achieved ? msStyles.dotAchieved : msStyles.dotPending]} >
          <Text style={msStyles.dotText}>{achieved ? '✓' : '○'}</Text>
        </View>
        <View style={msStyles.info}>
          <Text style={[msStyles.label, locked && msStyles.labelMuted]}>{label}</Text>
          <View style={msStyles.progressTrack}>
            <View style={[msStyles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={msStyles.progressLabel}>
            {locked ? '🔒 Unlocks at 60 days' : `${progress} / ${required} days`}
          </Text>
        </View>
      </View>
      <View style={[msStyles.bonusBadge, achieved && msStyles.bonusBadgeAchieved]}>
        <Text style={[msStyles.bonusText, achieved && msStyles.bonusTextAchieved]}>+${bonus.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const msStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowActive: { backgroundColor: colors.primaryLight + '88', marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  rowLocked: { opacity: 0.6 },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotAchieved: { backgroundColor: colors.primary },
  dotPending: { backgroundColor: colors.border },
  dotText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  info: { flex: 1, gap: 4 },
  label: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  labelMuted: { color: colors.textMuted },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: radius.full },
  progressLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  bonusBadge: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, marginLeft: spacing.md },
  bonusBadgeAchieved: { backgroundColor: colors.accent + '33', borderWidth: 1, borderColor: colors.accent },
  bonusText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.textMuted },
  bonusTextAchieved: { color: colors.accent },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RewardsTab() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;
  const tier = profile?.tier ?? 'free';
  const isMinor = profile?.is_minor ?? false;
  const createdAt = profile?.created_at ?? new Date().toISOString();

  const [monthSummaries, setMonthSummaries] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGiftCard, setShowGiftCard] = useState(false);

  useFocusEffect(useCallback(() => { if (userId) loadData(); }, [userId]));

  async function loadData() {
    setLoading(true);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    try {
      const [mRes, pRes] = await Promise.all([
        supabase.from('daily_summaries').select('day_successful,perfect_day,submitted').eq('user_id', userId).gte('date', monthStart),
        supabase.from('payouts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(12),
      ]);
      setMonthSummaries(mRes.data ?? []);
      setPayoutHistory(pRes.data ?? []);
    } catch {
      // payouts table may not exist yet — handle gracefully
    } finally {
      setLoading(false);
    }
  }

  if (isMinor) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.minorContainer}>
          <Text style={styles.minorEmoji}>🔒</Text>
          <Text style={styles.minorTitle}>Rewards not available</Text>
          <Text style={styles.minorBody}>
            Niyama Life rewards are available to users 18 and older. You can still track habits, build streaks, and earn points.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tierData = TIERS[tier];
  const ageDays = accountAgeDays(createdAt);
  const canRedeem = canRedeemBaseCap(createdAt);
  const canMilestone = canRedeemMilestoneBonuses(createdAt);
  const freeExpired = isFreeRewardExpired(tier, createdAt);

  // This month's metrics
  const submitted = monthSummaries.filter(s => s.submitted);
  const successfulDaysThisMonth = submitted.filter(s => s.day_successful).length;
  const perfectDaysThisMonth = submitted.filter(s => s.perfect_day).length;
  const totalDays = daysInCurrentMonth();

  // Points and reward calculation
  const monthlyPts = profile?.monthly_points ?? 0;
  const baseRewardEarned = Math.min(monthlyPts / POINTS_PER_DOLLAR, tierData.baseCap);
  const milestoneBonus = canMilestone
    ? calculateMonthMilestoneBonus(tier, { successfulDaysCount: successfulDaysThisMonth, perfectDaysCount: perfectDaysThisMonth, totalDaysInMonth: totalDays })
    : 0;
  const totalReward = baseRewardEarned + milestoneBonus;
  const baseProgressPct = Math.min((baseRewardEarned / tierData.baseCap) * 100, 100);

  // Active milestone (highest achieved)
  const activeMilestoneKey = MILESTONE_DEFINITIONS
    .slice()
    .reverse()
    .find(m => {
      const bonus = m.tiers[tier];
      if (!bonus || !canMilestone) return false;
      if (m.key === 'successfulDays10') return successfulDaysThisMonth >= 10;
      if (m.key === 'successfulDays20') return successfulDaysThisMonth >= 20;
      if (m.key === 'successfulMonth') return successfulDaysThisMonth >= totalDays;
      if (m.key === 'perfectMonth') return perfectDaysThisMonth >= totalDays;
      return false;
    })?.key ?? null;

  const canRedeemNow = canRedeem && totalReward > 0 && !freeExpired;

  async function handleRedeem(brand) {
    try {
      const { error } = await supabase.from('payouts').insert({
        user_id: userId,
        amount: totalReward,
        brand,
        status: 'pending',
        month: new Date().toISOString().slice(0, 7),
      });
      if (error) throw error;
      await supabase.from('profiles').update({ monthly_points: 0 }).eq('id', userId);
      await refreshProfile();
      await loadData();
      Alert.alert('Reward requested! 🎁', `Your $${totalReward.toFixed(2)} ${brand} gift card is being processed and will be delivered to your email within 24 hours.`);
      sendGiftCardNotification();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loadingContainer}><ActivityIndicator color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Rewards</Text>

        {/* This month's reward hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroMonth}>{currentMonthLabel()}</Text>
          <Text style={styles.heroAmount}>${totalReward.toFixed(2)}</Text>
          <Text style={styles.heroSub}>of ${tierData.baseCap.toFixed(2)} base cap</Text>

          {/* Base cap progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${baseProgressPct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{monthlyPts.toLocaleString()} pts earned this month</Text>

          <View style={styles.payoutCountdown}>
            <Text style={styles.payoutCountdownText}>
              🗓 Payout in {daysUntilPayout()} {daysUntilPayout() === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Account age gate — first 30 days */}
        {!canRedeem && (
          <View style={styles.gateCard}>
            <Text style={styles.gateEmoji}>⏳</Text>
            <Text style={styles.gateTitle}>Your first reward unlocks soon</Text>
            <Text style={styles.gateBody}>
              Rewards become redeemable after 30 days to protect against fraud.
              Unlocks on <Text style={styles.gateHighlight}>{unlockDateLabel(createdAt, 30)}</Text>.
            </Text>
            <View style={styles.gateCountdown}>
              <Text style={styles.gateCountdownText}>{daysRemainingUntil(createdAt, 30)} days remaining</Text>
            </View>
            <View style={styles.gateBalanceRow}>
              <Text style={styles.gateBalanceLabel}>Balance accumulating</Text>
              <Text style={styles.gateBalanceAmount}>${totalReward.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Free tier expiry */}
        {freeExpired && (
          <View style={styles.upsellCard}>
            <Text style={styles.upsellTitle}>Upgrade to keep earning rewards</Text>
            <Text style={styles.upsellBody}>
              Free tier rewards are available for your first 3 months. Upgrade to Basic, Plus, or Premium to continue earning.
            </Text>
            <View style={styles.upsellTiers}>
              {['basic','plus','premium'].map(t => (
                <View key={t} style={styles.upsellTierPill}>
                  <Text style={styles.upsellTierName}>{TIERS[t].label}</Text>
                  <Text style={styles.upsellTierCap}>Up to ${TIERS[t].maxMonthly}/mo</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Milestone ladder — Plus and Premium only */}
        {(tier === 'plus' || tier === 'premium') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Milestone bonuses</Text>
            <Text style={styles.cardSubtitle}>OR logic — only the highest milestone applies each month.</Text>
            {MILESTONE_DEFINITIONS.map(def => (
              <MilestoneRow
                key={def.key}
                definition={def}
                tier={tier}
                successfulDays={successfulDaysThisMonth}
                perfectDays={perfectDaysThisMonth}
                totalDays={totalDays}
                canClaimMilestones={canMilestone}
                isHighestActive={activeMilestoneKey === def.key}
              />
            ))}
            {!canMilestone && (
              <Text style={styles.milestoneGateNote}>
                🔒 Milestone bonuses unlock {daysRemainingUntil(createdAt, 60)} days from now ({unlockDateLabel(createdAt, 60)}).
              </Text>
            )}
          </View>
        )}

        {/* Redeem button */}
        <View style={styles.redeemSection}>
          <Pressable
            style={[styles.redeemBtn, !canRedeemNow && styles.redeemBtnDisabled]}
            onPress={() => canRedeemNow && setShowGiftCard(true)}
            disabled={!canRedeemNow}
          >
            <Text style={styles.redeemBtnText}>
              {freeExpired
                ? 'Upgrade to redeem'
                : !canRedeem
                  ? `Unlocks in ${daysRemainingUntil(createdAt, 30)} days`
                  : totalReward <= 0
                    ? 'No balance to redeem'
                    : `Redeem $${totalReward.toFixed(2)}`}
            </Text>
          </Pressable>
          {canRedeemNow && (
            <Text style={styles.redeemNote}>
              Gift card delivered to your email within 24 hours via Tremendous.
            </Text>
          )}
        </View>

        {/* Reward history */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payout history</Text>
          {payoutHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No payouts yet. Your first reward will appear here after redemption.</Text>
            </View>
          ) : (
            payoutHistory.map((p, i) => (
              <View key={i} style={[styles.historyRow, i < payoutHistory.length - 1 && styles.historyRowBorder]}>
                <View>
                  <Text style={styles.historyMonth}>{p.month}</Text>
                  <Text style={styles.historyBrand}>{p.brand} gift card</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>${parseFloat(p.amount).toFixed(2)}</Text>
                  <View style={[styles.statusBadge, p.status === 'processed' ? styles.statusProcessed : styles.statusPending]}>
                    <Text style={[styles.statusText, p.status === 'processed' ? styles.statusTextProcessed : styles.statusTextPending]}>
                      {p.status === 'processed' ? '✓ Delivered' : '⏳ Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <GiftCardModal
        visible={showGiftCard}
        balance={totalReward}
        onClose={() => setShowGiftCard(false)}
        onRedeem={handleRedeem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  screenTitle: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary },

  // Hero card
  heroCard: {
    backgroundColor: colors.primary, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  heroMonth: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: '#ffffff99' },
  heroAmount: { fontFamily: fonts.bold, fontSize: 56, color: '#FFFFFF', lineHeight: 60 },
  heroSub: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: '#ffffff99' },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: radius.full },
  progressLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: '#ffffff99' },
  payoutCountdown: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: spacing.sm },
  payoutCountdownText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: '#FFFFFF' },

  // Account age gate
  gateCard: {
    backgroundColor: '#FFF8E6', borderRadius: radius.lg, borderWidth: 1,
    borderColor: '#F0D080', padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  gateEmoji: { fontSize: 32 },
  gateTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: '#8A6A00', textAlign: 'center' },
  gateBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: '#7A5A00', textAlign: 'center', lineHeight: 22 },
  gateHighlight: { fontFamily: fonts.semiBold, color: '#5A4000' },
  gateCountdown: { backgroundColor: '#F0D080', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  gateCountdownText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: '#5A4000' },
  gateBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', borderTopWidth: 1, borderTopColor: '#F0D080', paddingTop: spacing.md, marginTop: spacing.sm },
  gateBalanceLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: '#8A6A00' },
  gateBalanceAmount: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: '#5A4000' },

  // Free expiry upsell
  upsellCard: {
    backgroundColor: colors.primaryLight, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.primary + '66', padding: spacing.xl, gap: spacing.md,
  },
  upsellTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.primary },
  upsellBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 22 },
  upsellTiers: { flexDirection: 'row', gap: spacing.sm },
  upsellTierPill: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  upsellTierName: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.textPrimary },
  upsellTierCap: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.accent },

  // Card wrapper
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.textPrimary, marginBottom: spacing.xs },
  cardSubtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  milestoneGateNote: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.md, lineHeight: 20 },

  // Redeem
  redeemSection: { gap: spacing.sm },
  redeemBtn: { backgroundColor: colors.secondary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  redeemBtnDisabled: { backgroundColor: colors.border },
  redeemBtnText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  redeemNote: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },

  // History
  emptyHistory: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyHistoryText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyMonth: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  historyBrand: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.primary },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusProcessed: { backgroundColor: '#E6F4EC' },
  statusPending: { backgroundColor: '#FFF8E6' },
  statusText: { fontFamily: fonts.semiBold, fontSize: fontSizes.xs },
  statusTextProcessed: { color: '#2E7D4F' },
  statusTextPending: { color: '#8A6A00' },

  // Minor protection
  minorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  minorEmoji: { fontSize: 48 },
  minorTitle: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, textAlign: 'center' },
  minorBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
