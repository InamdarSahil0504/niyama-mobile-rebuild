import { Image, View, StyleSheet } from 'react-native';

/**
 * Niyama Life icon — renders assets/niyama-icon.png at the requested size.
 * Replaces the original SVG placeholder.
 *
 * Props:
 *   size          — number, controls width and height (default 40)
 *   showBackground — bool, wraps the icon in a sage-green circle (default false)
 */
export default function NiyamaIcon({ size = 40, showBackground = false }) {
  const icon = (
    <Image
      source={require('../../assets/niyama-icon.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );

  if (!showBackground) return icon;

  return (
    <View style={[styles.bg, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={require('../../assets/niyama-icon.png')}
        style={{ width: size * 0.75, height: size * 0.75 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    backgroundColor: '#4A7A68',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
