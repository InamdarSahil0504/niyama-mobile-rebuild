import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const CONFETTI_COLORS = [
  colors.primary, colors.accent, colors.secondary,
  '#7BC8A4', '#F4A261', '#E9C46A', '#A8DADC',
];

function ConfettiPiece({ color, delay }) {
  const x = useRef(new Animated.Value(Math.random() * SCREEN_W)).current;
  const y = useRef(new Animated.Value(-20)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y, { toValue: 700, duration: 2200, useNativeDriver: true }),
        Animated.timing(x, {
          toValue: x._value + (Math.random() - 0.5) * 120,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, { toValue: 6, duration: 2200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1400),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 6], outputRange: ['0deg', '720deg'] });
  const size = 8 + Math.random() * 6;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: Math.random() > 0.5 ? size / 2 : 2,
        backgroundColor: color,
        transform: [{ translateX: x }, { translateY: y }, { rotate: spin }],
        opacity,
      }}
    />
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 600,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(p => <ConfettiPiece key={p.id} color={p.color} delay={p.delay} />)}
    </View>
  );
}

export default function ReadyScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate content in
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Fetch first name
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setFirstName(user.user_metadata.full_name.split(' ')[0]);
      }
    });
  }, []);

  async function handleStart() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('profiles').upsert({ id: user.id, onboarding_complete: true });
      router.replace('/(tabs)/');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Confetti />

      <Animated.View
        style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>
          {firstName ? `You're ready, ${firstName}!` : "You're ready!"}
        </Text>
        <Text style={styles.subtitle}>Your journey starts today.</Text>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>10</Text>
            <Text style={styles.statLabel}>Daily habits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>920</Text>
            <Text style={styles.statLabel}>Max pts/day</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>$0</Text>
            <Text style={styles.statLabel}>Day 0 rewards</Text>
          </View>
        </View>

        <Text style={styles.encouragement}>
          Every day you show up counts. Log your first day and start building your streak.
        </Text>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleStart}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Start Tracking →</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1, paddingHorizontal: spacing.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 64, marginBottom: spacing.lg, textAlign: 'center' },
  title: {
    fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.medium, fontSize: fontSizes.lg, color: colors.textSecondary,
    textAlign: 'center', marginBottom: spacing.xxl,
  },
  stats: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.primary, marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted,
    textAlign: 'center',
  },
  encouragement: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.md,
  },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md },
  btnPrimary: { backgroundColor: colors.secondary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF', letterSpacing: 0.3 },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
});
