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

interface WelcomeScreenProps {
  onDismiss: () => void;
}

/* ─── Paper palette ─── */
const PAPER = {
  bg: '#E8D66C',         // warm yellow paper
  bgLight: '#F0E08A',    // lighter yellow for subtle accents
  brown: '#4A3728',      // deep brown for headings
  brownLight: '#6B5744',  // lighter brown for body text
  brownMuted: '#8B7B6B',  // muted brown for secondary text
  divider: '#C4A84D',    // darker gold for lines
  cardBg: 'rgba(74, 55, 40, 0.06)', // very subtle brown tint
};

/* ─── Simple flat icons (brown, no fills) ─── */

function BrowseIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Rect x={1} y={1} width={8} height={8} rx={1.5} stroke={PAPER.brown} strokeWidth={1.8} />
      <Rect x={13} y={1} width={8} height={8} rx={1.5} stroke={PAPER.brown} strokeWidth={1.8} />
      <Rect x={1} y={13} width={8} height={8} rx={1.5} stroke={PAPER.brown} strokeWidth={1.8} />
      <Rect x={13} y={13} width={8} height={8} rx={1.5} stroke={PAPER.brown} strokeWidth={1.8} />
    </Svg>
  );
}

function ScanIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke={PAPER.brown}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={PAPER.brown} strokeWidth={1.8} />
    </Svg>
  );
}

function SaveIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={PAPER.brown}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke={PAPER.brown}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronUpIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15l-6-6-6 6"
        stroke={PAPER.brownMuted}
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
    paddingVertical: 11,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: PAPER.cardBg,
    borderWidth: 1,
    borderColor: PAPER.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: PAPER.brown,
    marginBottom: 2,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: PAPER.brownMuted,
    lineHeight: 18,
  },
});

/* ─── Welcome Screen ─── */

const SWIPE_THRESHOLD = 40;

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const dragY = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  // Pulse animation for the swipe hint
  const hintTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintTranslateY, {
          toValue: -5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(hintTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [hintTranslateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && gs.dy < 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -SWIPE_THRESHOLD && !dismissed.current) {
          dismissed.current = true;
          if (Platform.OS !== 'web') {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          }
          Animated.timing(dragY, {
            toValue: -height,
            duration: 500,
            useNativeDriver: true,
          }).start(() => onDismiss());
        } else {
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

  const shadowOpacity = dragY.interpolate({
    inputRange: [-height * 0.5, 0],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  const handleDismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    Animated.timing(dragY, {
      toValue: -height,
      duration: 500,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrapper]} pointerEvents="box-none">
      {/* Shadow underneath */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.5)', opacity: shadowOpacity },
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
        {/* Flat paper background */}
        <View style={styles.bgPaper} />

        {/* Thin top rule line */}
        <View style={[styles.topRule, { top: insets.top + 16 }]} />

        {/* Content */}
        <View style={[styles.content, { paddingTop: insets.top + 36 }]}>
          {/* Wordmark */}
          <View style={styles.header}>
            <Text style={styles.wordmark}>the{'\n'}pages</Text>
            <View style={styles.divider} />
            <Text style={styles.tagline}>discover what's happening around you</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Upload event posters and share with your mutuals
          </Text>

          {/* Features */}
          <View style={styles.features}>
            <FeatureRow
              icon={<BrowseIcon />}
              title="Browse Events"
              description="Flip through the bulletin from your mutuals"
            />
            <FeatureRow
              icon={<ScanIcon />}
              title="AI-Powered Posting"
              description="Upload a flyer, AI fills in all the details"
            />
            <FeatureRow
              icon={<SaveIcon />}
              title="Save"
              description="Save events and share them with friends"
            />
            <FeatureRow
              icon={<ShareIcon />}
              title="Discover"
              description="Link events from Instagram, Partiful, and beyond"
            />
          </View>

          {/* CTA */}
          <View style={styles.ctaSection}>
            <Animated.View
              style={[
                styles.swipeHintInner,
                { transform: [{ translateY: hintTranslateY }] },
              ]}
            >
              <ChevronUpIcon />
              <Text style={styles.swipeText}>Take a peek!</Text>
            </Animated.View>
            <TouchableOpacity
              style={styles.tapStartBtn}
              activeOpacity={0.7}
              onPress={handleDismiss}
            >
              <Text style={styles.tapStartText}>TAP TO START</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom edge line */}
        <View style={styles.bottomRule} />
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
    overflow: 'hidden',
  },
  bgPaper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PAPER.bg,
  },
  topRule: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 1.5,
    backgroundColor: PAPER.divider,
  },
  bottomRule: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PAPER.divider,
  },
  content: {
    flex: 1,
    paddingHorizontal: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  wordmark: {
    fontFamily: FONTS.display,
    fontSize: 40,
    lineHeight: 44,
    color: PAPER.brown,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  divider: {
    width: 50,
    height: 2,
    backgroundColor: PAPER.brown,
    marginTop: 16,
    marginBottom: 14,
  },
  tagline: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: PAPER.brownLight,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: PAPER.brownMuted,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  features: {
    gap: 2,
  },
  ctaSection: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 40,
    gap: 4,
  },
  swipeHintInner: {
    alignItems: 'center',
    gap: 4,
  },
  swipeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: PAPER.brownMuted,
    letterSpacing: 2,
  },
  tapStartBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 1.5,
    borderColor: PAPER.brown,
    borderRadius: 0,
  },
  tapStartText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PAPER.brown,
    letterSpacing: 2,
  },
});
