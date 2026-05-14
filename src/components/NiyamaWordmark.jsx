import { View, Text, StyleSheet } from 'react-native';
import NiyamaIcon from './NiyamaIcon';
import { colors, fonts, fontSizes, spacing } from '../theme';

/**
 * Full Niyama Life wordmark — icon + "Niyama" + "LIFE" stacked.
 * Used on the welcome screen and splash. Light background variant only
 * (niyama-wordmark-light) — no dark mode in Phase 6.
 *
 * Props:
 *   iconSize — number, controls icon size (default 64)
 *   layout   — 'vertical' (default) | 'horizontal'
 */
export default function NiyamaWordmark({ iconSize = 64, layout = 'vertical' }) {
  const isHorizontal = layout === 'horizontal';

  return (
    <View style={[styles.container, isHorizontal && styles.containerHorizontal]}>
      <NiyamaIcon size={iconSize} />
      <View style={[styles.textBlock, isHorizontal && styles.textBlockHorizontal]}>
        <Text style={styles.brandName}>Niyama</Text>
        <Text style={styles.brandSub}>LIFE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  textBlockHorizontal: {
    alignItems: 'flex-start',
    marginTop: 0,
    marginLeft: spacing.md,
  },
  brandName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  brandSub: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.primary,
    letterSpacing: 4,
  },
});
