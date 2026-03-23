import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

interface ExternalLinkWarningProps {
  visible: boolean;
  url: string;
  eventTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

/* ─── External Link Icon ─── */

function ExternalLinkIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke={COLORS.ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ─── ExternalLinkWarning Component ─── */

export function ExternalLinkWarning({
  visible,
  url,
  eventTitle,
  onClose,
  onConfirm,
}: ExternalLinkWarningProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <ExternalLinkIcon />
          </View>

          {/* Title */}
          <Text style={styles.title}>YOU'RE LEAVING THE PAGES</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Opening link for {eventTitle}
          </Text>

          {/* URL preview */}
          <Text style={styles.urlPreview} numberOfLines={1}>
            {url}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              activeOpacity={0.8}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>OPEN LINK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(2,4,15,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  urlPreview: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.ink,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.ink,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.ink,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
});
