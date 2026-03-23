import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

interface WelcomeScreenProps {
  onDismiss: () => void;
}

/* ─── Decorative Icons ─── */

function StarIcon({ size = 16, color = COLORS.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

function BrowseIcon({ size = 20, color = COLORS.text70 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Rect x={1} y={1} width={8} height={8} rx={2} fill={color} />
      <Rect x={13} y={1} width={8} height={8} rx={2} fill={color} />
      <Rect x={1} y={13} width={8} height={8} rx={2} fill={color} />
      <Rect x={13} y={13} width={8} height={8} rx={2} fill={color} />
    </Svg>
  );
}

function SaveIcon({ size = 20, color = COLORS.text70 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon({ size = 20, color = COLORS.text70 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ScanIcon({ size = 20, color = COLORS.text70 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/* ─── Chevron Up Icon ─── */

function ChevronUpIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15l-6-6-6 6"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ─── Feature Row ─── */

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View style={featureStyles.row}>
      <View style={featureStyles.iconWrap}>{icon}</View>
      <View style={featureStyles.textWrap}>
        <Text style={featureStyles.title}>{title}</Text>
        <Text style={featureStyles.desc}>{description}</Text>
      </View>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text60,
    lineHeight: 18,
  },
});

/* ─── Welcome Screen ─── */

const SWIPE_THRESHOLD = 40;

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Page-turn animation: rotate around the bottom edge
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  // Pulse animation for the swipe hint
  const hintTranslateY = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;

  // Decorative star float
  const starFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Swipe hint pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintTranslateY, {
          toValue: -6,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(hintTranslateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Decorative star floating
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(starFloat, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(starFloat, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    floatAnim.start();

    return () => {
      pulse.stop();
      floatAnim.stop();
    };
  }, [hintTranslateY, starFloat]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && gs.dy < 0, // only swipe up
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) {
          dragY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -SWIPE_THRESHOLD && !dismissed.current) {
          dismissed.current = true;

          // Haptic feedback
          if (Platform.OS !== 'web') {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          }

          // Animate the page turn: rotate up and away
          Animated.timing(dragY, {
            toValue: -height,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          // Spring back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 60,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Page-turn transform: rotate around bottom edge
  // As user drags up (dragY goes negative), the page rotates like turning a page
  const rotateX = dragY.interpolate({
    inputRange: [-height, 0],
    outputRange: ['-90deg', '0deg'],
    extrapolate: 'clamp',
  });

  const translateY = dragY.interpolate({
    inputRange: [-height, 0],
    outputRange: [-height * 0.3, 0],
    extrapolate: 'clamp',
  });

  const opacity = dragY.interpolate({
    inputRange: [-height, -height * 0.5, 0],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  // Shadow that gets stronger as page lifts
  const shadowOpacity = dragY.interpolate({
    inputRange: [-height * 0.5, 0],
    outputRange: [0.6, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrapper]} pointerEvents="box-none">
      {/* Shadow underneath the turning page */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.7)', opacity: shadowOpacity },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.page,
          {
            width,
            height,
            opacity,
            transform: [
              { perspective: 1200 },
              { translateY },
              { rotateX },
            ],
          },
        ]}
      >
        {/* Background gradient layers */}
        <View style={styles.bgBase} />
        <View style={styles.bgAccent} />

        {/* Decorative elements */}
        <Animated.View
          style={[
            styles.decoStar1,
            { transform: [{ translateY: starFloat }] },
          ]}
          pointerEvents="none"
        >
          <StarIcon size={20} color={COLORS.gold} />
        </Animated.View>
        <Animated.View
          style={[
            styles.decoStar2,
            {
              transform: [
                {
                  translateY: Animated.multiply(starFloat, -1),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <StarIcon size={14} color={COLORS.pink} />
        </Animated.View>

        {/* Content */}
        <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
          {/* Wordmark */}
          <View style={styles.header}>
            <Text style={styles.wordmark}>THE PAGES</Text>
            <View style={styles.divider} />
            <Text style={styles.tagline}>Your community, one page at a time</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Discover local events through beautiful, fullscreen flyers.
            Snap a photo of any event poster — our AI reads it and shares
            it with your community.
          </Text>

          {/* Features */}
          <View style={styles.features}>
            <FeatureRow
              icon={<BrowseIcon color={COLORS.gold} />}
              title="Browse Events"
              description="Scroll through fullscreen flyers from your community"
            />
            <FeatureRow
              icon={<ScanIcon color={COLORS.gold} />}
              title="AI-Powered Posting"
              description="Upload a flyer and AI fills in all the details"
            />
            <FeatureRow
              icon={<SaveIcon color={COLORS.gold} />}
              title="Save & Share"
              description="Bookmark events you love and share them with friends"
            />
            <FeatureRow
              icon={<ShareIcon color={COLORS.gold} />}
              title="Discovery Layer"
              description="Surface events from Instagram, Partiful, and beyond"
            />
          </View>
        </View>

        {/* Swipe hint + tap to start at the bottom */}
        <View
          style={[
            styles.swipeHint,
            { bottom: insets.bottom + 40 },
          ]}
        >
          <Animated.View
            style={[
              styles.swipeHintInner,
              { transform: [{ translateY: hintTranslateY }] },
            ]}
          >
            <ChevronUpIcon />
            <Text style={styles.swipeText}>Swipe up to start browsing</Text>
          </Animated.View>
          <TouchableOpacity
            style={styles.tapStartBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (!dismissed.current) {
                dismissed.current = true;
                if (Platform.OS !== 'web') {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                }
                Animated.timing(dragY, {
                  toValue: -height,
                  duration: 500,
                  useNativeDriver: true,
                }).start(() => onDismiss());
              }
            }}
          >
            <Text style={styles.tapStartText}>Tap to start</Text>
          </TouchableOpacity>
        </View>

        {/* Page curl effect — subtle bottom edge */}
        <View style={styles.pageCurlEdge} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Transform origin at the bottom: achieved via translateY offset in transform
    overflow: 'hidden',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.ink,
  },
  bgAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(120, 184, 150, 0.15)', // subtle teal wash
  },
  decoStar1: {
    position: 'absolute',
    top: '12%',
    right: 40,
  },
  decoStar2: {
    position: 'absolute',
    top: '18%',
    left: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  wordmark: {
    fontFamily: FONTS.display,
    fontSize: 36,
    letterSpacing: 8,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.pink,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 14,
  },
  tagline: {
    fontFamily: FONTS.bodyItalic,
    fontSize: 16,
    color: COLORS.text70,
    textAlign: 'center',
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text60,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  features: {
    gap: 4,
  },
  swipeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  swipeHintInner: {
    alignItems: 'center',
    gap: 6,
  },
  tapStartBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  tapStartText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  swipeText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.text40,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageCurlEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
});
