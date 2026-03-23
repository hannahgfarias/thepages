import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOverlay } from '../app/(tabs)/_layout';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

const REPORT_OPTIONS = [
  'Misleading or incorrect info',
  'Inappropriate content',
  'Spam or duplicate',
  'Harmful or dangerous',
];

export function ReportSheet() {
  const { showReport, setShowReport } = useOverlay();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showReport) {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 400,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 300,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideY.setValue(height);
      scrimOpacity.setValue(0);
    }
  }, [showReport, slideY, scrimOpacity, height]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 350,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 250,
        easing: EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowReport(false);
    });
  };

  const handleSelect = (_option: string) => {
    handleClose();
  };

  if (!showReport) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Scrim */}
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Title */}
        <Text style={styles.sheetTitle}>Report This Event</Text>

        {/* Options */}
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={styles.option}
            activeOpacity={0.6}
            onPress={() => handleSelect(option)}
          >
            <Text style={styles.optionText}>{option}</Text>
          </TouchableOpacity>
        ))}

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelOption}
          activeOpacity={0.6}
          onPress={handleClose}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.scrim,
    zIndex: 90,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.sheetDarkBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 91,
    paddingHorizontal: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  optionText: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
  },
  cancelOption: {
    paddingVertical: 16,
    marginTop: 8,
  },
  cancelText: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
  },
});
