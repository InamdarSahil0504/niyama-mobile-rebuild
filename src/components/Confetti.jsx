import { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
const COLORS = ['#4A7A68', '#C96A52', '#C9973A', '#7BC4A0', '#F4A896', '#E8D87A', '#B4D4E8'];
const COUNT = 28;

function makeParticle() {
  return {
    x: Math.random() * (W - 10),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    delay: Math.floor(Math.random() * 500),
    duration: 1400 + Math.floor(Math.random() * 900),
    endDeg: (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 240),
    circle: Math.random() > 0.45,
  };
}

export default function Confetti({ visible }) {
  const particles = useRef(
    Array.from({ length: COUNT }, () => ({
      ...makeParticle(),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rot: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    particles.forEach(p => { p.y.setValue(0); p.opacity.setValue(0); p.rot.setValue(0); });

    const anims = particles.map(p =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: 580, duration: p.duration, useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: 1, duration: p.duration, useNativeDriver: true }),
        ]),
      ])
    );
    Animated.parallel(anims).start();

    const t = setTimeout(() => {
      Animated.parallel(
        particles.map(p => Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }))
      ).start();
    }, 1600);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -16,
            left: p.x,
            width: p.size,
            height: p.circle ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: p.circle ? p.size : 2,
            opacity: p.opacity,
            transform: [
              { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.endDeg}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
