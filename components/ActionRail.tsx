import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ActionRailProps {
  visible: boolean;
  onSave: () => void;
  onShare: () => void;
  onMore: () => void;
  isSaved: boolean;
}

/* ─── SVG Icons ─── */

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z"
        stroke={filled ? '#ffffff' : '#02040F'}
        strokeWidth={1.5}
        fill={filled ? '#ffffff' : 'none'}
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M12 3l4 4M12 3L8 7M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"
        stroke="#02040F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 8a2 2 0 110-4 2 2 0 010 4zM12 14a2 2 0 110-4 2 2 0 010 4zM12 20a2 2 0 110-4 2 2 0 010 4z"
        stroke="#02040F"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/* ─── Action Rail Component ─── */

export function ActionRail({
  visible,
  onSave,
  onShare,
  onMore,
  isSaved,
}: ActionRailProps) {
  const translateX = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const easing = Easing.bezier(0.16, 1, 0.3, 1);
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 350,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 350,
          easing,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 20,
          duration: 250,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          easing,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, opacity]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Save */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          isSaved && styles.actionButtonSaved,
        ]}
        onPress={onSave}
        activeOpacity={0.7}
      >
        <BookmarkIcon filled={isSaved} />
      </TouchableOpacity>

      {/* Share */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onShare}
        activeOpacity={0.7}
      >
        <ShareIcon />
      </TouchableOpacity>

      {/* More */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onMore}
        activeOpacity={0.7}
      >
        <MoreIcon />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 50,
    elevation: 50,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: 'rgba(229,218,218,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  actionButtonSaved: {
    backgroundColor: '#EB736C',
    borderColor: '#EB736C',
  },
});
