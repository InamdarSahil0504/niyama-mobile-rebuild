import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing, radius } from '../theme';

/**
 * Silent green verification badge shown on HealthKit-confirmed habits.
 * Points are always identical regardless of verification (App Store compliance).
 *
 * type: 'verified' | 'confirmable' | 'honour'
 */
export default function VerifiedBadge({ type = 'verified', style }) {
  if (type === 'verified') {
    return (
      <View style={[styles.badge, styles.verifiedBadge, style]}>
        <Text style={styles.verifiedText}>✓ Verified</Text>
      </View>
    );
  }
  if (type === 'confirmable') {
    return (
      <View style={[styles.badge, styles.confirmableBadge, style]}>
        <Text style={styles.confirmableText}>Photo</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.honourBadge, style]}>
      <Text style={styles.honourText}>Self</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  verifiedBadge: { backgroundColor: '#E6F4EC' },
  verifiedText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: '#2E7D4F',
    letterSpacing: 0.2,
  },
  confirmableBadge: { backgroundColor: '#EEF2FF' },
  confirmableText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: '#4B5EAA',
  },
  honourBadge: { backgroundColor: colors.background },
  honourText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
});
