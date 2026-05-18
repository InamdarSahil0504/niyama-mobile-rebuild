import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NOTIFICATION_TYPES } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const NOTIFICATION_LIST = [
  { icon: '☀️', label: 'Morning wake alert', description: 'Start your day with intention.' },
  { icon: '🌿', label: 'Midday check-in reminder', description: 'Log habits as you complete them.' },
  { icon: '🔥', label: 'Streak protection at 9pm', description: "Don't lose your streak before midnight." },
  { icon: '🎁', label: 'Gift card delivered', description: "We'll tell you when your reward arrives." },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications off',
          'You can enable them later in Settings → Preferences.',
          [{ text: 'Continue', onPress: () => router.push('/(onboarding)/9-ready') }]
        );
        return;
      }
      router.push('/(onboarding)/9-ready');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '88%' }]} />
        </View>
        <Text style={styles.stepLabel}>8 of 9</Text>

        <Text style={styles.emoji}>🔔</Text>
        <Text style={styles.title}>Stay consistent with smart nudges</Text>
        <Text style={styles.subtitle}>
          Niyama Life sends four types of notifications. You can customise them later in Settings.
        </Text>

        <View style={styles.notifList}>
          {NOTIFICATION_LIST.map((n, i) => (
            <View key={i} style={styles.notifRow}>
              <View style={styles.notifIconWrap}>
                <Text style={styles.notifIcon}>{n.icon}</Text>
              </View>
              <View style={styles.notifText}>
                <Text style={styles.notifLabel}>{n.label}</Text>
                <Text style={styles.notifDesc}>{n.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleEnable}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Enable Notifications</Text>
          }
        </Pressable>
        <Pressable
          style={styles.skipBtn}
          onPress={() => router.push('/(onboarding)/9-ready')}
          disabled={loading}
        >
          <Text style={styles.skipText}>Maybe later</Text>
        </Pressable>
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
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xxl },
  notifList: { gap: spacing.md },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.lg,
  },
  notifIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  notifIcon: { fontSize: 20 },
  notifText: { flex: 1 },
  notifLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary, marginBottom: 2 },
  notifDesc: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  skipText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
});
