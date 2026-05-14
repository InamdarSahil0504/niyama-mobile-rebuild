import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Animated,
} from 'react-native';
import { MOOD_OPTIONS } from '../config';
import { colors, fonts, fontSizes, spacing, radius } from '../theme';

/**
 * Mood check-in bottom sheet. Fires automatically after day submission.
 * Selected emoji springs to 1.3x scale; others fade to 0.3 opacity.
 * Auto-dismisses 600ms after selection.
 *
 * Props:
 *   visible      — boolean
 *   onSelect     — (moodValue: 1–5) => void
 *   onSkip       — () => void
 *   selectedMood — number | null
 */
export default function MoodCheckIn({ visible, onSelect, onSkip, selectedMood }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  // Keep Modal mounted until slide-out animation completes so it isn't cut.
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setModalVisible(false));
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      {/* Tapping the dark backdrop dismisses like Skip */}
      <Pressable style={styles.backdrop} onPress={onSkip}>
        {/* Stop propagation so taps inside the sheet don't close it */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>How did today feel?</Text>
          <Text style={styles.subtitle}>A quick check-in helps track your well-being over time.</Text>

          <View style={styles.emojiRow}>
            {MOOD_OPTIONS.map(option => (
              <MoodOption
                key={option.value}
                option={option}
                isSelected={selectedMood === option.value}
                hasSelection={selectedMood !== null}
                onPress={() => onSelect(option.value)}
              />
            ))}
          </View>

          <Pressable style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Skip for today</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function MoodOption({ option, isSelected, hasSelection, onPress }) {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.3 : 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: hasSelection && !isSelected ? 0.3 : 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected, hasSelection]);

  return (
    <Pressable onPress={onPress} style={styles.moodOption}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
        <Text style={styles.moodEmoji}>{option.emoji}</Text>
        <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
          {option.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xxl,
  },
  moodOption: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  moodEmoji: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  moodLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    width: 52,
  },
  moodLabelSelected: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textMuted,
  },
});
