import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const FOUNDER_LETTER = `I built Niyama Life because I got tired of apps that track your habits but give you nothing back.

Every morning I'd check in — sleep, steps, phone usage — and the app would show me a green streak. Nice. But after 90 days, I realised the streak was the only reward. No accountability. No financial skin in the game.

The science is clear: when your health behaviours are tied to real outcomes, you stick to them. Not because you're disciplined — because the system makes it rational.

Niyama Life is my attempt to build that system. Ten evidence-backed daily habits. Real cash rewards for consistency. A health dashboard that shows you what's actually happening inside your body.

This isn't a habit tracker. It's a behaviour change platform.

I hope it changes your life the way it's changed mine.

— Sahil Inamdar
Founder & CEO, Niyama Life Inc.`;

export default function FounderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '11%' }]} />
        </View>

        <Text style={styles.stepLabel}>1 of 9</Text>

        {/* Photo placeholder */}
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoInitials}>SI</Text>
        </View>

        <Text style={styles.title}>A note from the founder</Text>

        <View style={styles.letterCard}>
          <Text style={styles.letterText}>{FOUNDER_LETTER}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={() => router.push('/(onboarding)/2-how-it-works')}
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
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  photoInitials: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  letterCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  letterText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    lineHeight: 24,
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
