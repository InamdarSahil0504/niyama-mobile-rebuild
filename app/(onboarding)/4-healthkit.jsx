import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { HEALTHKIT_READ_TYPES, trackEvent } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

// HealthKit is iOS-only and requires EAS Build (not available in Expo Go)
let Core = null;
if (Platform.OS === 'ios') {
  try {
    Core = require('@kingstinct/react-native-healthkit').default;
  } catch {
    // silently unavailable in Expo Go / simulators without native build
  }
}

const PREVIEW_CARDS = [
  {
    icon: '🌅',
    title: 'Circadian Consistency Score',
    value: '87',
    unit: '/ 100',
    insight: 'Your wake time varied by only 18 minutes this month.',
    blurred: true,
  },
  {
    icon: '❤️',
    title: 'HRV Trend',
    value: '↑ 14%',
    unit: 'last 30 days',
    insight: 'Higher HRV on days you completed No Phone after 10:30pm.',
    blurred: true,
  },
];

export default function HealthKitScreen() {
  const router = useRouter();
  const [researchConsent, setResearchConsent] = useState(true);
  const [loading, setLoading] = useState(false);

  async function connectHealthKit() {
    if (!Core) {
      Alert.alert('Not available', 'Apple Health integration requires a physical device and EAS Build.');
      return false;
    }
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
      return true;
    } catch (err) {
      console.log('HealthKit auth error:', err);
      return false;
    }
  }

  async function saveAndContinue(healthkitConnected) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('profiles').upsert({
        id: user.id,
        research_consent: researchConsent, // mirrors toggle state; defaults true
      });
      // Audit trail — fires regardless of which button the user tapped
      trackEvent(supabase, user.id, 'research_consent_changed', {
        consent: researchConsent,
        source: 'onboarding',
      });
      router.push('/(onboarding)/5-tier');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    const connected = await connectHealthKit();
    await saveAndContinue(connected);
  }

  async function handleSkip() {
    await saveAndContinue(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '44%' }]} />
        </View>
        <Text style={styles.stepLabel}>4 of 9</Text>

        <Text style={styles.emoji}>🍎</Text>
        <Text style={styles.title}>Connect Apple Health</Text>
        <Text style={styles.subtitle}>
          Auto-verify your habits. Build your personal health dashboard.
        </Text>

        {/* Blurred preview cards */}
        <View style={styles.previews}>
          {PREVIEW_CARDS.map((card, i) => (
            <View key={i} style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewIcon}>{card.icon}</Text>
                <Text style={styles.previewTitle}>{card.title}</Text>
              </View>
              <View style={styles.previewValueRow}>
                <Text style={[styles.previewValue, card.blurred && styles.blurred]}>{card.value}</Text>
                <Text style={styles.previewUnit}>{card.unit}</Text>
              </View>
              <Text style={[styles.previewInsight, card.blurred && styles.blurred]}>
                {card.insight}
              </Text>
              {card.blurred && (
                <View style={styles.blurOverlay}>
                  <Text style={styles.blurLabel}>Connect to unlock</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Research consent toggle */}
        <Pressable style={styles.consentRow} onPress={() => setResearchConsent(v => !v)}>
          <View style={[styles.checkbox, researchConsent && styles.checkboxActive]}>
            {researchConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            Help advance health science — allow Niyama Life to use anonymised data for research
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleConnect}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Connect Apple Health</Text>
          }
        </Pressable>
        <Pressable style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
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
  emoji: { fontSize: 40, marginBottom: spacing.md, textAlign: 'center' },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl, textAlign: 'center' },
  previews: { gap: spacing.md, marginBottom: spacing.xl },
  previewCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, overflow: 'hidden',
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewIcon: { fontSize: 18 },
  previewTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  previewValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginBottom: spacing.xs },
  previewValue: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.primary },
  previewUnit: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted },
  previewInsight: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary },
  blurred: { opacity: 0.15 },
  blurOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(245,247,244,0.6)',
  },
  blurLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 12, fontFamily: fonts.bold },
  consentText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 22, flex: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.background, gap: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textMuted },
});
