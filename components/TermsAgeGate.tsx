import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

interface TermsAgeGateProps {
  visible: boolean;
  onAccept: () => void;
}

/* ─── Checkbox Component ─── */

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      activeOpacity={0.7}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17l-5-5"
              stroke="#ffffff"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── TermsAgeGate Component ─── */

export function TermsAgeGate({ visible, onAccept }: TermsAgeGateProps) {
  const insets = useSafeAreaInsets();
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);

  const canContinue = agreedTerms && confirmedAge;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom },
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>WELCOME TO THE PAGES</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Before you continue, please review and accept the following:
          </Text>

          {/* Section 1: Terms of Service */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms of Service</Text>
            <Text style={styles.sectionBody}>
              By using The Pages you agree to our terms governing your use of the
              platform, including content you post, your interactions with other
              users, and your responsibilities as a member of our community.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert(
                'Terms of Service',
                'The Pages is a community event discovery platform. By using the app you agree to: (1) not post harmful, hateful, or illegal content; (2) not impersonate others; (3) respect copyright and intellectual property; (4) not use the platform for commercial spam. We reserve the right to remove content and suspend accounts that violate these terms. Full terms available at thepages.app/terms.'
              )}
            >
              <Text style={styles.link}>Read full Terms of Service</Text>
            </TouchableOpacity>
          </View>

          {/* Section 2: Privacy Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Policy</Text>
            <Text style={styles.sectionBody}>
              We collect minimal data needed to operate the app. Your information
              is never sold to third parties. You can request deletion of your
              data at any time through your profile settings.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert(
                'Privacy Policy',
                'We collect: phone number (for authentication), event posts you create, and your save/follow activity. We do NOT sell your data to third parties. AI is used to moderate content and scan flyer images. You can delete your account and all data at any time in Settings. Full policy available at thepages.app/privacy.'
              )}
            >
              <Text style={styles.link}>Read full Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {/* Section 3: Community Guidelines */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Guidelines</Text>
            <Text style={styles.sectionBody}>
              The Pages is a space for community events. Content promoting hate
              speech, violence, harassment, or illegal activity is strictly
              prohibited and will be removed. All uploads are reviewed by AI
              moderation before appearing publicly.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert(
                'Community Guidelines',
                'The Pages is for community events only. Prohibited content includes: hate speech, graphic violence, adult/sexual content, content sexualizing minors, personal information (doxxing), spam or scams, dangerous activities. All uploads are AI-moderated before appearing publicly. Posts receiving 3+ community reports are automatically hidden for review. Violations may result in account suspension. Full guidelines at thepages.app/guidelines.'
              )}
            >
              <Text style={styles.link}>Read Community Guidelines</Text>
            </TouchableOpacity>
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxGroup}>
            <Checkbox
              checked={agreedTerms}
              onToggle={() => setAgreedTerms((v) => !v)}
              label="I agree to the Terms of Service and Privacy Policy"
            />
            <Checkbox
              checked={confirmedAge}
              onToggle={() => setConfirmedAge((v) => !v)}
              label="I confirm that I am 18 years of age or older"
            />
          </View>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            By continuing, you acknowledge that The Pages may use AI to moderate
            content. For DMCA takedown requests, contact dmca@thepages.app
          </Text>
        </ScrollView>

        {/* Sticky continue button */}
        <View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            activeOpacity={canContinue ? 0.8 : 1}
            onPress={canContinue ? onAccept : undefined}
            disabled={!canContinue}
          >
            <Text style={styles.continueText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.alabaster,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.ink,
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 21,
    marginBottom: 8,
  },
  link: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.teal,
  },
  checkboxGroup: {
    gap: 20,
    marginTop: 8,
    marginBottom: 28,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  checkboxLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.ink,
    flex: 1,
    lineHeight: 21,
  },
  finePrint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8,
  },
  buttonContainer: {
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: COLORS.alabaster,
    borderTopWidth: 1,
    borderTopColor: 'rgba(2,4,15,0.06)',
  },
  continueButton: {
    backgroundColor: COLORS.custard,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.3,
  },
  continueText: {
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.ink,
  },
});
