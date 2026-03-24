import React from 'react';
import {
  View,
  TouchableOpacity,
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
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z"
        stroke={filled ? '#ffffff' : '#ffffff'}
        strokeWidth={1.5}
        fill={filled ? '#ffffff' : 'none'}
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M12 3l4 4M12 3L8 7M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"
        stroke="#ffffff"
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
  return (
    <>
      {/* More button — top right, always subtle */}
      <TouchableOpacity
        style={styles.moreButton}
        onPress={onMore}
        activeOpacity={0.7}
      >
        <MoreIcon />
      </TouchableOpacity>

      {/* Save & Share — bottom right, always visible on the flyer */}
      <View style={styles.bottomActions}>
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

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onShare}
          activeOpacity={0.7}
        >
          <ShareIcon />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  moreButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229,218,218,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
    elevation: 50,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2,4,15,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSaved: {
    backgroundColor: '#EB736C',
  },
});
