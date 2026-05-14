import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import NiyamaWordmark from '../../src/components/NiyamaWordmark';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.logoSection}>
        <NiyamaWordmark iconSize={80} layout="vertical" />
      </View>

      <View style={styles.taglineSection}>
        <Text style={styles.tagline}>Daily discipline.</Text>
        <Text style={styles.tagline}>Backed by science.</Text>
        <Text style={styles.tagline}>Rewarded financially.</Text>
      </View>

      <View style={styles.buttonSection}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnPrimaryText}>Sign Up</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.btnSecondaryText}>Log In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl * 2,
  },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    lineHeight: 26,
    textAlign: 'center',
  },
  buttonSection: {
    gap: spacing.md,
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
    letterSpacing: 0.3,
  },
  btnSecondary: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  btnPressed: {
    opacity: 0.75,
  },
});
