import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const CARDS = [
  {
    icon: '🏃',
    title: '10 daily habits',
    body: '3 core habits (wake, sleep, steps) auto-verified by Apple Health. 7 library habits covering phone use, sunlight, nutrition, recovery, and more.',
  },
  {
    icon: '⭐',
    title: 'Earn points every day',
    body: 'Up to 920 points per day. Core habits earn up to 300 points. Library habits earn 350 points. Bonus points for consistency and perfect days.',
  },
  {
    icon: '✅',
    title: 'Successful days count',
    body: 'Complete at least 2 of 3 core habits and 3 of 7 library habits. That\'s a successful day — and it earns you a bonus.',
  },
  {
    icon: '🎁',
    title: 'Rewards paid as gift cards',
    body: 'Every 1,000 points = $1.00. Monthly payouts via Amazon, Starbucks, Nike, Apple, and more. Real money for real behaviour change.',
  },
  {
    icon: '🔥',
    title: 'Streaks that mean something',
    body: 'Build a streak by logging every day. At 7, 14, and 30 days, unlock milestone messages. Pause your account for up to 30 days without losing your streak.',
  },
];

export default function HowItWorksScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '22%' }]} />
        </View>
        <Text style={styles.stepLabel}>2 of 9</Text>

        <Text style={styles.title}>How Niyama Life works</Text>
        <Text style={styles.subtitle}>Five things you need to know before you start.</Text>

        <View style={styles.cards}>
          {CARDS.map((card, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardIcon}>{card.icon}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBody}>{card.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={() => router.push('/(onboarding)/3-personal')}
        >
          <Text style={styles.btnPrimaryText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  stepLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'right',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  cards: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  cardIcon: { fontSize: 28, marginTop: 2 },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: '#FFFFFF',
  },
  btnPressed: { opacity: 0.75 },
});
