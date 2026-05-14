import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { TIERS } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

export default function PaymentScreen() {
  const router = useRouter();
  const { tier } = useLocalSearchParams();
  const tierData = TIERS[tier] ?? TIERS.plus;

  async function openPricing() {
    await WebBrowser.openBrowserAsync('https://niyamalife.com/pricing');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '55%' }]} />
        </View>
        <Text style={styles.stepLabel}>5 of 9</Text>

        <View style={styles.content}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>Complete your subscription</Text>
          <Text style={styles.subtitle}>
            To activate {tierData.label}, visit niyamalife.com/pricing to complete payment securely.
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={styles.summaryValue}>{tierData.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price</Text>
              <Text style={styles.summaryValue}>${tierData.price.monthly}/month</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Max reward</Text>
              <Text style={[styles.summaryValue, styles.summaryValueAccent]}>
                Up to ${tierData.maxMonthly.toFixed(2)}/mo
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            Your onboarding will continue after you open the pricing page. You can also complete payment later from Settings → Billing.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={openPricing}
          >
            <Text style={styles.btnPrimaryText}>Open niyamalife.com/pricing →</Text>
          </Pressable>

          <Pressable
            style={styles.skipBtn}
            onPress={() => router.push('/(onboarding)/6-wake-time')}
          >
            <Text style={styles.skipText}>Continue without paying</Text>
          </Pressable>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Change plan</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  progressBar: { height: 3, backgroundColor: colors.border, borderRadius: radius.full, marginBottom: spacing.md },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: radius.full },
  stepLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'right' },
  content: { flex: 1, justifyContent: 'center' },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  summaryCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary },
  summaryValue: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  summaryValueAccent: { color: colors.accent },
  note: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginTop: spacing.lg,
  },
  footer: { paddingBottom: spacing.xl, gap: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textMuted },
  backBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.primary },
});
