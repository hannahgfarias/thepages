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
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';
import { useOverlay } from '../app/(tabs)/_layout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { detectCity, pickImageFromLibrary } from '../lib/platform';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TermsAgeGate } from './TermsAgeGate';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const TERMS_ACCEPTED_KEY = 'the_pages_terms_accepted';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

const PREFERENCE_TYPES = ['Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre'];

const AVATAR_COLORS = ['#EB736C', '#78B896', '#67C9E3', '#E9D25E', '#C49BDE', '#F4A261'];

type Step = 'phone' | 'otp' | 'profile' | 'preferences';

export function AuthFlow() {
  const { showAuth, setShowAuth } = useOverlay();
  const { signIn, verifyOTP, updateProfile, setPreferences, checkHandleAvailable, skip, session } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Profile step state
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [loadingCity, setLoadingCity] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isOver18, setIsOver18] = useState(false);

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
      setDisplayName('');
      setHandle('');
      setBio('');
      setAvatarUri(null);
      setAvatarColor(AVATAR_COLORS[0]);
      setHandleError(null);
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

  const handleSendCode = async () => {
    if (rawPhoneDigits.length === 10) {
      setSendingCode(true);
      setOtpError(null);
      try {
        console.log('[AUTH] Sending OTP to:', rawPhoneDigits);
        const result = await signIn(rawPhoneDigits);
        console.log('[AUTH] signIn result:', JSON.stringify(result));
        if (result?.error) {
          setOtpError(result.error);
          return;
        }
        setStep('otp');
      } catch (e: any) {
        console.log('[AUTH] signIn exception:', e);
        setOtpError('Something went wrong. Try again.');
      } finally {
        setSendingCode(false);
      }
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

  const handleVerify = async () => {
    if (otpCode.length === 6) {
      setVerifying(true);
      setOtpError(null);
      try {
        console.log('[AUTH] Verifying OTP...');
        const success = await verifyOTP(otpCode);
        console.log('[AUTH] verifyOTP result:', success);
        if (success) {
          setOtpError(null);
          // Check if this is a returning user (has display_name set)
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
            .maybeSingle();

          if (existingProfile?.display_name) {
            // Returning user — skip onboarding, go straight to feed
            console.log('[AUTH] Returning user, closing auth flow');
            handleClose();
          } else {
            // New user — show terms if not yet accepted, then profile setup
            let accepted: string | null = null;
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              accepted = window.localStorage.getItem(TERMS_ACCEPTED_KEY);
            } else {
              accepted = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
            }
            if (accepted === 'true') {
              setStep('profile');
            } else {
              setShowTerms(true);
            }
          }
        } else {
          setOtpError('Invalid or expired code. Try again or resend.');
        }
      } catch (e: any) {
        console.log('[AUTH] verifyOTP exception:', e);
        setOtpError(e?.message || 'Something went wrong. Try again.');
      } finally {
        setVerifying(false);
      }
    }
  };

  // Detect city on demand when user taps "Use my location"
  const handleDetectCity = async () => {
    setLoadingCity(true);
    try {
      const detected = await detectCity();
      if (detected) {
        setCity(detected);
      } else {
        setProfileError('Could not detect your city. Type it in manually.');
      }
    } catch {
      setProfileError('Location access denied. Type your city manually.');
    } finally {
      setLoadingCity(false);
    }
  };

  const handleResend = () => {
    signIn(rawPhoneDigits);
  };

  // Pick avatar photo (works on web + native)
  const pickAvatar = async () => {
    try {
      const picked = await pickImageFromLibrary({ aspect: [1, 1], quality: 0.8 });
      if (picked) {
        setAvatarUri(picked.uri);
      }
    } catch {
      setProfileError('Could not open photo picker.');
    }
  };

  // Validate handle uniqueness on blur
  const validateHandle = async () => {
    if (!handle) {
      setHandleError(null);
      return;
    }
    // Basic format check
    const clean = handle.replace(/^@/, '');
    if (clean.length < 2) {
      setHandleError('Too short');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setHandleError('Letters, numbers, and underscores only');
      return;
    }
    setCheckingHandle(true);
    const available = await checkHandleAvailable(clean);
    setCheckingHandle(false);
    if (!available) {
      setHandleError('Handle taken');
    } else {
      setHandleError(null);
    }
  };

  // Save profile and move to preferences
  const handleProfileContinue = async () => {
    if (handleError) return;
    setSavingProfile(true);
    setProfileError(null);

    try {
      const profileData: Record<string, string> = {};
      if (displayName.trim()) profileData.display_name = displayName.trim();
      if (handle.trim()) {
        const clean = handle.replace(/^@/, '');
        profileData.handle = `@${clean}`;
      }
      if (bio.trim()) profileData.bio = bio.trim();
      if (city.trim()) profileData.location = city.trim();

      // Avatar
      if (avatarUri) {
        try {
          const { readFileAsBase64 } = require('../lib/platform');
          const base64 = await readFileAsBase64(avatarUri);
          const userId = session?.user?.id;
          if (userId) {
            const filePath = `${userId}/avatar.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, decode(base64), {
                contentType: 'image/jpeg',
                upsert: true,
              });
            if (uploadError) {
              setProfileError('Photo upload failed. Your profile will use initials instead.');
              // Fall back to initials
              const initial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?';
              profileData.avatar_initials = initial;
              profileData.avatar_color = avatarColor;
            } else {
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
              profileData.avatar_url = urlData.publicUrl;
            }
          }
        } catch {
          setProfileError('Photo upload failed. Your profile will use initials instead.');
          const initial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?';
          profileData.avatar_initials = initial;
          profileData.avatar_color = avatarColor;
        }
      } else {
        const initial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?';
        profileData.avatar_initials = initial;
        profileData.avatar_color = avatarColor;
      }

      if (Object.keys(profileData).length > 0) {
        const result = await updateProfile(profileData);
        if (result?.error) {
          setProfileError('Failed to save profile. Tap Continue to retry.');
          setSavingProfile(false);
          return;
        }
      }

      setSavingProfile(false);
      setStep('preferences');
    } catch {
      setProfileError('Something went wrong. Tap Continue to retry.');
      setSavingProfile(false);
    }
  };

  // Skip profile step
  const handleProfileSkip = () => {
    setStep('preferences');
  };

  const handleLetsGo = async () => {
    try {
      await setPreferences({ categories: selectedPrefs, is_over_18: isOver18 });
    } catch {
      // Preferences are non-critical — user can set them later in settings
    }
    handleClose();
  };

  const handleSkip = () => {
    skip();
    handleClose();
  };

  const handleTermsAccepted = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    } else {
      AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    }
    setShowTerms(false);
    setStep('profile');
  };

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  if (!showAuth) return null;

  // Compute avatar display
  const avatarInitial = displayName.trim() ? displayName.trim()[0].toUpperCase() : '?';

  return (
    <>
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

                {otpError && (
                  <Text style={styles.errorText}>{otpError}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (rawPhoneDigits.length < 10 || sendingCode) && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleSendCode}
                  disabled={rawPhoneDigits.length < 10 || sendingCode}
                >
                  <Text style={styles.primaryButtonText}>
                    {sendingCode ? 'SENDING...' : 'SEND CODE'}
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

                {otpError && (
                  <Text style={styles.errorText}>{otpError}</Text>
                )}

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
                  disabled={otpCode.length < 6 || verifying}
                >
                  <Text style={styles.primaryButtonText}>
                    {verifying ? 'VERIFYING...' : 'VERIFY'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: Profile Setup */}
            {step === 'profile' && (
              <View style={styles.stepContainer}>
                <Text style={styles.prefsTitle}>Set up your profile</Text>

                {/* Avatar */}
                <TouchableOpacity
                  style={[
                    styles.avatarPicker,
                    !avatarUri && { backgroundColor: avatarColor },
                  ]}
                  activeOpacity={0.8}
                  onPress={pickAvatar}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitialText}>{avatarInitial}</Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.avatarHint}>tap to add photo</Text>

                {/* Color presets (only if no photo) */}
                {!avatarUri && (
                  <View style={styles.colorRow}>
                    {AVATAR_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorDot,
                          { backgroundColor: color },
                          avatarColor === color && styles.colorDotSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setAvatarColor(color)}
                      />
                    ))}
                  </View>
                )}

                {/* Display Name */}
                <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
                <TextInput
                  style={styles.profileInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(2,4,15,0.35)"
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                {/* Handle */}
                <Text style={styles.fieldLabel}>HANDLE</Text>
                <View style={styles.handleRow}>
                  <View style={styles.handleAt}>
                    <Text style={styles.handleAtText}>@</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.handleInput,
                      handleError && { borderColor: '#EB736C' },
                      handle && !handleError && !checkingHandle && { borderColor: '#78B896' },
                    ]}
                    value={handle.replace(/^@/, '')}
                    onChangeText={(v) => {
                      setHandle(v.replace(/[^a-zA-Z0-9_]/g, ''));
                      setHandleError(null);
                    }}
                    onBlur={validateHandle}
                    placeholder="username"
                    placeholderTextColor="rgba(2,4,15,0.35)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
                {handleError && (
                  <Text style={styles.errorText}>{handleError}</Text>
                )}

                {/* Bio */}
                <Text style={styles.fieldLabel}>BIO</Text>
                <TextInput
                  style={[styles.profileInput, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor="rgba(2,4,15,0.35)"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* City */}
                <Text style={styles.fieldLabel}>CITY</Text>
                <View style={styles.cityRow}>
                  <TextInput
                    style={[styles.profileInput, styles.cityInput]}
                    value={city}
                    onChangeText={setCity}
                    placeholder={loadingCity ? "Detecting..." : "Your city"}
                    placeholderTextColor="rgba(2,4,15,0.35)"
                    editable={!loadingCity}
                  />
                  <TouchableOpacity
                    style={[
                      styles.locationButton,
                      loadingCity && styles.buttonDisabled,
                    ]}
                    activeOpacity={0.7}
                    onPress={handleDetectCity}
                    disabled={loadingCity}
                  >
                    <Text style={styles.locationButtonText}>
                      {loadingCity ? '...' : '📍'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Age confirmation */}
                <TouchableOpacity
                  style={styles.ageCheckRow}
                  activeOpacity={0.7}
                  onPress={() => setIsOver18(!isOver18)}
                >
                  <View style={[styles.checkbox, isOver18 && styles.checkboxChecked]}>
                    {isOver18 && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.ageCheckText}>I'm 18 or older</Text>
                </TouchableOpacity>
                <Text style={styles.ageCheckHint}>
                  Check this to see nightlife and 18+ events
                </Text>

                {profileError && (
                  <TouchableOpacity onPress={() => setProfileError(null)} activeOpacity={0.7}>
                    <Text style={styles.errorText}>{profileError} ✕</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!!handleError || savingProfile) && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleProfileContinue}
                  disabled={!!handleError || savingProfile}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingProfile ? 'SAVING...' : 'CONTINUE'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipLink}
                  activeOpacity={0.7}
                  onPress={handleProfileSkip}
                >
                  <Text style={styles.skipText}>skip for now</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 4: Preferences */}
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

    {/* Terms & Age Gate — shown after OTP for new users */}
    <TermsAgeGate visible={showTerms} onAccept={handleTermsAccepted} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0ECEC',
    zIndex: 310,
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

  /* Profile step */
  avatarPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarInitialText: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: '#ffffff',
  },
  avatarHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: 'rgba(2,4,15,0.4)',
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#02040F',
    borderWidth: 2.5,
  },
  profileInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: '#02040F',
    marginBottom: 16,
  },
  bioInput: {
    height: 80,
    paddingTop: 14,
  },
  handleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
    width: '100%',
  },
  handleAt: {
    width: 44,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleAtText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: 'rgba(2,4,15,0.5)',
  },
  handleInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: '#02040F',
  },
  cityRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  cityInput: {
    flex: 1,
    marginBottom: 0,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E9D25E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: {
    fontSize: 20,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#EB736C',
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
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

  /* Age gate checkbox */
  ageCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    marginBottom: 4,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(2,4,15,0.25)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#78B896',
    borderColor: '#78B896',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  ageCheckText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
  },
  ageCheckHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    alignSelf: 'flex-start',
    marginBottom: 16,
    marginLeft: 36,
  },
});
