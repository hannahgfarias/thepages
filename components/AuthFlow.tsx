import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOverlay } from '../app/(tabs)/_layout';
import { useAuth } from '../hooks/useAuth';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

const PREFERENCE_TYPES = ['Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre'];

type Step = 'phone' | 'otp' | 'preferences';

export function AuthFlow() {
  const { showAuth, setShowAuth } = useOverlay();
  const { signIn, verifyOTP, setPreferences, skip } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [city, setCity] = useState('');

  const opacity = useRef(new Animated.Value(0)).current;

  // OTP input refs
  const otpRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (showAuth) {
      setStep('phone');
      setPhone('');
      setOtpDigits(['', '', '', '', '', '']);
      setSelectedPrefs([]);
      setCity('');
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        easing: EASING,
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [showAuth, opacity]);

  const handleClose = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      easing: EASING,
      useNativeDriver: true,
    }).start(() => {
      setShowAuth(false);
    });
  }, [opacity, setShowAuth]);

  // Phone formatting helper
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
    if (digits.length <= 6)
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const rawPhoneDigits = phone.replace(/\D/g, '');

  const handleSendCode = () => {
    if (rawPhoneDigits.length === 10) {
      signIn(rawPhoneDigits);
      setStep('otp');
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newDigits = [...otpDigits];
      newDigits[index - 1] = '';
      setOtpDigits(newDigits);
    }
  };

  const otpCode = otpDigits.join('');

  const handleVerify = () => {
    if (otpCode.length === 6) {
      const success = verifyOTP(otpCode);
      if (success) {
        setStep('preferences');
      }
    }
  };

  const handleResend = () => {
    signIn(rawPhoneDigits);
  };

  const handleLetsGo = () => {
    setPreferences({ categories: selectedPrefs, city });
    handleClose();
  };

  const handleSkip = () => {
    skip();
    handleClose();
  };

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  if (!showAuth) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Wordmark */}
            <Text style={styles.wordmark}>THE PAGES</Text>
            <Text style={styles.subtitle}>
              discover what's happening around you
            </Text>

            {/* Step 1: Phone */}
            {step === 'phone' && (
              <View style={styles.stepContainer}>
                <Text style={styles.fieldLabel}>YOUR PHONE NUMBER</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+1</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      rawPhoneDigits.length === 10 && { borderColor: '#78B896' },
                      rawPhoneDigits.length > 0 && rawPhoneDigits.length < 10 && { borderColor: '#EB736C' },
                    ]}
                    value={phone}
                    onChangeText={(v) => setPhone(formatPhone(v))}
                    placeholder="(555) 123-4567"
                    placeholderTextColor="rgba(2,4,15,0.35)"
                    keyboardType="phone-pad"
                    maxLength={14}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    rawPhoneDigits.length < 10 && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleSendCode}
                  disabled={rawPhoneDigits.length < 10}
                >
                  <Text style={styles.primaryButtonText}>SEND CODE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipLink}
                  activeOpacity={0.7}
                  onPress={handleSkip}
                >
                  <Text style={styles.skipText}>
                    just browsing — skip for now
                  </Text>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                  By continuing, you agree to our Terms of Service and Privacy
                  Policy. We'll send a verification code to your phone.
                </Text>
              </View>
            )}

            {/* Step 2: OTP */}
            {step === 'otp' && (
              <View style={styles.stepContainer}>
                <Text style={styles.otpInstruction}>
                  Enter the 6-digit code sent to your phone
                </Text>

                <View style={styles.otpRow}>
                  {otpDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        otpRefs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        digit ? styles.otpInputFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(v) => handleOTPChange(index, v)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOTPKeyPress(index, nativeEvent.key)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      autoFocus={index === 0}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.resendLink}
                  activeOpacity={0.7}
                  onPress={handleResend}
                >
                  <Text style={styles.resendText}>
                    Didn't get it? Resend code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    otpCode.length < 6 && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleVerify}
                  disabled={otpCode.length < 6}
                >
                  <Text style={styles.primaryButtonText}>VERIFY</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: Preferences */}
            {step === 'preferences' && (
              <View style={styles.stepContainer}>
                <Text style={styles.prefsTitle}>What are you into?</Text>

                <View style={styles.prefsChips}>
                  {PREFERENCE_TYPES.map((pref) => (
                    <TouchableOpacity
                      key={pref}
                      activeOpacity={0.7}
                      onPress={() => togglePref(pref)}
                      style={[
                        styles.prefChip,
                        selectedPrefs.includes(pref) && styles.prefChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.prefChipText,
                          selectedPrefs.includes(pref) &&
                            styles.prefChipTextSelected,
                        ]}
                      >
                        {pref}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.cityInput}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Your city"
                  placeholderTextColor="rgba(2,4,15,0.35)"
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.8}
                  onPress={handleLetsGo}
                >
                  <Text style={styles.primaryButtonText}>LET'S GO</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipLink}
                  activeOpacity={0.7}
                  onPress={handleClose}
                >
                  <Text style={styles.skipText}>skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0ECEC',
    zIndex: 120,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#02040F',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 40,
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
  },

  /* Phone step */
  fieldLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(2,4,15,0.5)',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  countryCode: {
    width: 72,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: '#02040F',
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: '#02040F',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#E9D25E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  primaryButtonText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#02040F',
  },
  skipLink: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  skipText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
  },
  legalText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 300,
  },

  /* OTP step */
  otpInstruction: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.6)',
    marginBottom: 24,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
    fontFamily: FONTS.mono,
    fontSize: 24,
    color: '#02040F',
  },
  otpInputFilled: {
    borderColor: '#78B896',
  },
  otpInputInvalid: {
    borderColor: '#EB736C',
  },
  resendLink: {
    paddingVertical: 8,
    marginBottom: 20,
  },
  resendText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
  },

  /* Preferences step */
  prefsTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#02040F',
    marginBottom: 20,
  },
  prefsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    justifyContent: 'center',
  },
  prefChip: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  prefChipSelected: {
    backgroundColor: '#E9D25E',
    borderColor: '#E9D25E',
  },
  prefChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#02040F',
  },
  prefChipTextSelected: {
    color: '#02040F',
  },
  cityInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#02040F',
    marginBottom: 24,
  },
});
