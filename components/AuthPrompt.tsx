import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TermsAgeGate } from './TermsAgeGate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOverlay } from '../app/(tabs)/_layout';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface AuthPromptProps {
  message?: string;
}

const TERMS_ACCEPTED_KEY = 'the_pages_terms_accepted';

export function AuthPrompt({ message }: AuthPromptProps) {
  const { showAuthPrompt, setShowAuthPrompt, setShowAuth } = useOverlay();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [showTerms, setShowTerms] = useState(false);

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showAuthPrompt) {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 250,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 200,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideY.setValue(height);
      scrimOpacity.setValue(0);
    }
  }, [showAuthPrompt, slideY, scrimOpacity, height]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 220,
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
      setShowAuthPrompt(false);
    });
  };

  const proceedToAuth = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 300,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 200,
        easing: EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAuthPrompt(false);
      setShowAuth(true);
    });
  };

  const handleSignUp = async () => {
    // Go directly to phone entry — terms acceptance moved to after OTP for new users
    proceedToAuth();
  };

  const handleTermsAccepted = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    } else {
      AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    }
    setShowTerms(false);
    proceedToAuth();
  };

  if (!showAuthPrompt) return null;

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
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Join The Pages</Text>

        {/* Contextual message */}
        <Text style={styles.message}>
          {message ||
            'Sign in or create an account to save events, post flyers, and connect with your community.'}
        </Text>

        {/* Sign in button */}
        <TouchableOpacity
          style={styles.signUpButton}
          activeOpacity={0.8}
          onPress={handleSignUp}
        >
          <Text style={styles.signUpText}>CONTINUE WITH PHONE</Text>
        </TouchableOpacity>

        {/* Dismiss link */}
        <TouchableOpacity
          style={styles.dismissLink}
          activeOpacity={0.7}
          onPress={handleClose}
        >
          <Text style={styles.dismissText}>not now</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Terms & Age Gate — shown before auth if not yet accepted */}
      <TermsAgeGate visible={showTerms} onAccept={handleTermsAccepted} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 105,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0ECEC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 106,
    paddingHorizontal: 24,
    alignItems: 'center',
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
    backgroundColor: 'rgba(2,4,15,0.15)',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: '#02040F',
    marginBottom: 10,
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 24,
  },
  signUpButton: {
    width: '100%',
    backgroundColor: '#E9D25E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  signUpText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#02040F',
  },
  dismissLink: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  dismissText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
  },
});
