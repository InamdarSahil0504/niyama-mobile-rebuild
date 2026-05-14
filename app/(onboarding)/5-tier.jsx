import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { TIERS, TIER_ORDER } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const TIER_FEATURES = {
  free: ['Track all 10 habits', 'Earn points daily', 'Basic streak tracking', 'Up to $2.50/mo reward (first 3 months)'],
  basic: ['Everything in Free', 'Up to $5.00/mo reward', 'Full streak history', 'Analytics dashboard'],
  plus: ['Everything in Basic', 'Up to $17.50/mo reward', 'Milestone bonuses', '2 custom habits earn points', 'Full health analytics'],
  premium: ['Everything in Plus', 'Up to $35.00/mo reward', 'All milestone bonuses', '4 custom habits earn points', 'Priority support'],
};

const ANNUAL_DISCOUNT = 0.17; // ~17% off

export default function TierSelectScreen() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState('plus');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(false);

  function getPrice(tierKey) {
    const tier = TIERS[tierKey];
    if (tier.price.monthly === 0) return 'Free';
    if (billingCycle === 'annual') {
      const annual = (tier.price.monthly * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(0);
      return `$${annual}/yr`;
    }
    return `$${tier.price.monthly}/mo`;
  }

  async function handleContinue() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('profiles').upsert({ id: user.id, tier: selectedTier });

      if (selectedTier === 'free' || selectedTier === 'basic') {
        // Free/Basic: no payment step needed, but basic requires $0.99
        // Both skip to wake time for now — payment handled on web
        router.push('/(onboarding)/6-wake-time');
      } else {
        router.push({
          pathname: '/(onboarding)/5b-payment',
          params: { tier: selectedTier },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '55%' }]} />
        </View>
        <Text style={styles.stepLabel}>5 of 9</Text>

        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.subtitle}>You can change or cancel anytime.</Text>

        {/* Billing toggle */}
        <View style={styles.billingToggle}>
          {['monthly', 'annual'].map(cycle => (
            <Pressable
              key={cycle}
              style={[styles.billingOption, billingCycle === cycle && styles.billingOptionActive]}
              onPress={() => setBillingCycle(cycle)}
            >
              <Text style={[styles.billingText, billingCycle === cycle && styles.billingTextActive]}>
                {cycle === 'monthly' ? 'Monthly' : 'Annual  🏷️ Save 17%'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tier cards */}
        <View style={styles.cards}>
          {TIER_ORDER.map(tierKey => {
            const tier = TIERS[tierKey];
            const selected = selectedTier === tierKey;
            const recommended = tierKey === 'plus';

            return (
              <Pressable
                key={tierKey}
                style={[styles.card, selected && styles.cardSelected, recommended && styles.cardRecommended]}
                onPress={() => setSelectedTier(tierKey)}
              >
                {recommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>RECOMMENDED</Text>
                  </View>
                )}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.tierName}>{tier.label}</Text>
                    <Text style={styles.tierPrice}>{getPrice(tierKey)}</Text>
                  </View>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardBadgeLabel}>Up to</Text>
                    <Text style={styles.rewardBadgeAmount}>${tier.maxMonthly.toFixed(2)}</Text>
                    <Text style={styles.rewardBadgeLabel}>/mo</Text>
                  </View>
                </View>
                <View style={styles.featureList}>
                  {TIER_FEATURES[tierKey].map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Text style={[styles.featureCheck, selected && styles.featureCheckSelected]}>✓</Text>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                {selected && <View style={styles.selectedIndicator} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>
                {selectedTier === 'free' ? 'Continue with Free' : `Continue with ${TIERS[selectedTier].label}`}
              </Text>
          }
        </Pressable>
        <Text style={styles.footerNote}>No commitment. Cancel anytime.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  progressBar: { height: 3, backgroundColor: colors.border, borderRadius: radius.full, marginBottom: spacing.md },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: radius.full },
  stepLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'right' },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.xl },
  billingToggle: {
    flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md,
    padding: 3, marginBottom: spacing.xl,
  },
  billingOption: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm - 2 },
  billingOptionActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  billingText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textMuted },
  billingTextActive: { color: colors.textPrimary, fontFamily: fonts.semiBold },
  cards: { gap: spacing.md },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.border, padding: spacing.lg, overflow: 'hidden',
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  cardRecommended: { borderColor: colors.primary },
  recommendedBadge: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 3,
    borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.sm,
  },
  recommendedText: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: '#fff', letterSpacing: 0.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  tierName: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary },
  tierPrice: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 2 },
  rewardBadge: { alignItems: 'flex-end' },
  rewardBadgeLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  rewardBadgeAmount: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.accent },
  featureList: { gap: spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureCheck: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.border, width: 16 },
  featureCheckSelected: { color: colors.primary },
  featureText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, flex: 1 },
  selectedIndicator: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 4,
    backgroundColor: colors.primary, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg,
  },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.background, gap: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
  footerNote: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
});
