import { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Image } from 'react-native';
import { colors, fonts, fontSizes, spacing, radius } from '../theme';

/**
 * Single habit row with animated checkbox.
 *
 * Props:
 *   habit            — { key, label, icon, verificationMethod }
 *   checked          — boolean
 *   onToggle         — () => void
 *   disabled         — boolean (day submitted)
 *   points           — number
 *   subLabel         — string | null  (e.g. "8,432 steps · 75 pts")
 *   showUpgradeChip  — boolean
 *   photoUrl         — string | null  (thumbnail after photo upload)
 */
export default function HabitRow({
  habit,
  checked,
  onToggle,
  disabled = false,
  points,
  subLabel,
  showUpgradeChip = false,
  photoUrl = null,
}) {
  const scaleAnim = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const rowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: checked ? 1 : 0,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [checked]);

  function handlePress() {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(rowScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.spring(rowScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onToggle();
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View style={[styles.row, checked && styles.rowChecked, { transform: [{ scale: rowScale }] }]}>
        {/* Animated checkbox */}
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          <Animated.Text style={[styles.checkmark, { transform: [{ scale: scaleAnim }] }]}>
            ✓
          </Animated.Text>
        </View>

        {/* Icon + labels */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.icon}>{habit.icon}</Text>
            <Text style={[styles.label, checked && styles.labelChecked]} numberOfLines={1}>
              {habit.label}
            </Text>
            {/* Small green badge — only shown when checked, no text label */}
            {checked && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeIcon}>✓</Text>
              </View>
            )}
          </View>
          {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.thumbnail} resizeMode="cover" />
          ) : null}
        </View>

        {/* Right side: points or upgrade chip */}
        <View style={styles.right}>
          {showUpgradeChip ? (
            <View style={styles.upgradeChip}>
              <Text style={styles.upgradeChipText}>Upgrade</Text>
            </View>
          ) : (
            <Text style={[styles.points, checked && styles.pointsChecked]}>
              {points > 0 ? `+${points}` : '0'} pts
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.bold,
    lineHeight: 16,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: { fontSize: 16 },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  labelChecked: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  // Small green ✓ badge — no label, just the dot
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBadgeIcon: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: fonts.bold,
    lineHeight: 11,
  },
  subLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  points: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.textMuted,
  },
  pointsChecked: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  upgradeChip: {
    backgroundColor: colors.accent + '22',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  upgradeChipText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.accent,
  },
});
