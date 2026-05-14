import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { colors, fonts, fontSizes, spacing } from '../theme';
import NiyamaIcon from './NiyamaIcon';

// --------------------------------------------------------------------------
// SVG icons — outline (inactive) and filled (active)
// --------------------------------------------------------------------------

function StatsIcon({ size, color, filled }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {filled ? (
        <G fill={color}>
          <Rect x="3" y="13" width="4" height="8" rx="1" />
          <Rect x="10" y="8" width="4" height="13" rx="1" />
          <Rect x="17" y="4" width="4" height="17" rx="1" />
        </G>
      ) : (
        <G fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="13" width="4" height="8" rx="1" />
          <Rect x="10" y="8" width="4" height="13" rx="1" />
          <Rect x="17" y="4" width="4" height="17" rx="1" />
        </G>
      )}
    </Svg>
  );
}

function RewardsIcon({ size, color, filled }) {
  const pts = '12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={`M${pts.split(' ').join('L')}Z`}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HistoryIcon({ size, color, filled }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {filled ? (
        <G>
          <Circle cx="12" cy="12" r="10" fill={color} />
          <Path d="M12 6v6l3.5 3.5" fill="none" stroke={colors.card} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      ) : (
        <G fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6v6l3.5 3.5" strokeLinejoin="round" />
        </G>
      )}
    </Svg>
  );
}

function SettingsIcon({ size, color, filled }) {
  const gear = 'M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5 3.5 3.5 0 0 1 15.5 12 3.5 3.5 0 0 1 12 15.5M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={gear} fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={1.4} strokeLinejoin="round" />
      {filled && <Circle cx="12" cy="12" r="3.5" fill={colors.card} />}
    </Svg>
  );
}

// Tab config — index handled specially with NiyamaIcon
const ICONS = {
  rewards:   { Icon: RewardsIcon,  label: 'Rewards' },
  analytics: { Icon: StatsIcon,    label: 'Stats' },
  index:     { Icon: null,         label: '' },      // Home — NiyamaIcon, no label
  history:   { Icon: HistoryIcon,  label: 'History' },
  settings:  { Icon: SettingsIcon, label: 'Settings' },
};

const ICON_SIZE = 22;

// --------------------------------------------------------------------------
// TabBar
// --------------------------------------------------------------------------

export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const config = ICONS[route.name] ?? { Icon: RewardsIcon, label: route.name };
        const tint = isFocused ? colors.primary : colors.textMuted;
        const isHome = route.name === 'index';

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        function onLongPress() {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        }

        // ── Home tab — raised NiyamaIcon circle, no dot, no label ──
        if (isHome) {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel="Home"
              onPress={onPress}
              onLongPress={onLongPress}
              style={s.homeTab}
            >
              <View style={[s.homeCircle, isFocused && s.homeCircleFocused]}>
                <NiyamaIcon size={28} showBackground={false} />
              </View>
            </Pressable>
          );
        }

        // ── Regular tabs ──
        const { Icon, label } = config;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={s.tab}
          >
            <View style={s.dotWrap}>
              {isFocused && <View style={s.dot} />}
            </View>
            <View style={s.iconWrap}>
              <Icon size={ICON_SIZE} color={tint} filled={isFocused} />
            </View>
            <Text style={[s.label, isFocused && s.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    alignItems: 'flex-end',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: spacing.xs,
  },
  dotWrap: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  iconWrap: { marginBottom: 3 },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  // Home tab — raised circle
  homeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xs,
  },
  homeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    marginTop: -20,
    borderWidth: 3,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  homeCircleFocused: {
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
});
