import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Linking } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useOverlay } from '../app/(tabs)/_layout';
import { supabase } from '../lib/supabase';
import { pickImageFromLibrary, readFileAsBase64 } from '../lib/platform';
import { decode } from 'base64-arraybuffer';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';
import type { BioLink } from '../types';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);
const HANDLE_COOLDOWN_DAYS = 30;

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/* ─── Section Header ─── */
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

/* ─── Editable Field ─── */
function EditableField({
  label,
  value,
  onSave,
  placeholder,
  disabled,
  disabledMessage,
  multiline,
  prefix,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledMessage?: string;
  multiline?: boolean;
  prefix?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing && !disabled) {
    return (
      <View style={styles.editableField}>
        <Text style={styles.editableLabel}>{label}</Text>
        <View style={styles.editRow}>
          {prefix && <Text style={styles.editPrefix}>{prefix}</Text>}
          <TextInput
            style={[styles.editInput, multiline && styles.editInputMultiline]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor="rgba(2,4,15,0.3)"
            autoFocus
            multiline={multiline}
            autoCapitalize={autoCapitalize || 'sentences'}
            autoCorrect={false}
          />
        </View>
        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.editCancel}
            onPress={() => { setDraft(value); setEditing(false); }}
          >
            <Text style={styles.editCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editSave}
            onPress={() => { onSave(draft); setEditing(false); }}
          >
            <Text style={styles.editSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={disabled ? 1 : 0.6}
      onPress={() => {
        if (disabled && disabledMessage) {
          if (Platform.OS === 'web') {
            window.alert(disabledMessage);
          } else {
            Alert.alert('Handle Change', disabledMessage);
          }
        } else {
          setEditing(true);
        }
      }}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={[styles.settingValue, disabled && styles.settingValueDisabled]}>
        {value || placeholder || 'Add'}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── Settings Sheet ─── */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { profile, signOut, updateProfile, checkHandleAvailable, session, refreshProfile } = useAuth();
  const { setShowProfile } = useOverlay();

  // Animation
  const translateX = useRef(new Animated.Value(height)).current;

  // Settings state
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [bioLinks, setBioLinks] = useState<BioLink[]>([]);
  const [handleLastChanged, setHandleLastChanged] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state from profile when sheet opens
  useEffect(() => {
    if (visible && profile) {
      setDisplayName(profile.display_name || '');
      setHandle(profile.handle || '');
      setBio(profile.bio || '');
      setBioLinks(profile.bio_links || []);
      setCity(profile.location || '');
      setIsPrivate(!profile.is_public);
      setSaveError(null);
      // Fetch handle_last_changed
      if (session?.user?.id) {
        supabase
          .from('profiles')
          .select('handle_last_changed')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setHandleLastChanged(data?.handle_last_changed || null);
          });
      }
    }
  }, [visible, profile, session]);

  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        easing: EASING,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: height,
        duration: 300,
        easing: EASING,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateX, height]);

  const handleClose = () => {
    Animated.timing(translateX, {
      toValue: height,
      duration: 300,
      easing: EASING,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  // Check if handle change is allowed (30-day cooldown)
  const canChangeHandle = () => {
    if (!handleLastChanged) return true;
    const lastChanged = new Date(handleLastChanged);
    const now = new Date();
    const diffDays = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= HANDLE_COOLDOWN_DAYS;
  };

  const daysUntilHandleChange = () => {
    if (!handleLastChanged) return 0;
    const lastChanged = new Date(handleLastChanged);
    const now = new Date();
    const diffDays = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(HANDLE_COOLDOWN_DAYS - diffDays));
  };

  // Save field
  const saveField = async (field: string, value: string) => {
    setSaveError(null);
    const data: Record<string, any> = {};

    if (field === 'display_name') {
      setDisplayName(value);
      data.display_name = value;
      if (!profile?.avatar_url) {
        data.avatar_initials = value ? value[0].toUpperCase() : '?';
      }
    } else if (field === 'handle') {
      const clean = value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
      if (clean.length < 2) {
        setSaveError('Handle must be at least 2 characters');
        return;
      }
      const available = await checkHandleAvailable(clean);
      if (!available) {
        setSaveError('That handle is taken');
        return;
      }
      const formatted = `@${clean}`;
      setHandle(formatted);
      data.handle = formatted;
      data.handle_last_changed = new Date().toISOString();
    } else if (field === 'bio') {
      setBio(value);
      data.bio = value;
    } else if (field === 'location') {
      setCity(value);
      data.location = value;
    }

    const result = await updateProfile(data);
    if (result?.error) {
      setSaveError(result.error);
    }
  };

  // Avatar change
  const changeAvatar = async () => {
    try {
      const picked = await pickImageFromLibrary({ aspect: [1, 1], quality: 0.8 });
      if (!picked || !session?.user?.id) return;

      const base64 = picked.base64 || await readFileAsBase64(picked.uri);
      const filePath = `${session.user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        setSaveError('Photo upload failed');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: urlData.publicUrl } as any);
      await refreshProfile();
    } catch {
      setSaveError('Could not change photo');
    }
  };

  // Bio links management
  const MAX_BIO_LINKS = 5;

  const saveBioLinks = async (links: BioLink[]) => {
    setBioLinks(links);
    const result = await updateProfile({ bio_links: links } as any);
    if (result?.error) {
      setSaveError('Failed to save links');
    }
  };

  const addBioLink = () => {
    if (bioLinks.length >= MAX_BIO_LINKS) return;
    const updated = [...bioLinks, { label: '', url: '' }];
    setBioLinks(updated);
  };

  const updateBioLink = (index: number, field: 'label' | 'url', value: string) => {
    const updated = [...bioLinks];
    updated[index] = { ...updated[index], [field]: value };
    setBioLinks(updated);
  };

  const saveBioLink = (index: number) => {
    const link = bioLinks[index];
    // Validate URL
    let url = link.url.trim();
    if (url && !url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    const updated = [...bioLinks];
    updated[index] = { label: link.label.trim(), url };
    // Remove if both empty
    if (!updated[index].label && !updated[index].url) {
      updated.splice(index, 1);
    }
    saveBioLinks(updated);
  };

  const removeBioLink = (index: number) => {
    const updated = bioLinks.filter((_, i) => i !== index);
    saveBioLinks(updated);
  };

  const togglePrivate = async (value: boolean) => {
    setIsPrivate(value);
    const result = await updateProfile({ is_public: !value } as any);
    if (result?.error) {
      setIsPrivate(!value);
      setSaveError('Failed to update privacy setting');
    }
  };

  const handleSignOut = () => {
    const doSignOut = async () => {
      await signOut();
      handleClose();
      setShowProfile(false);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        doSignOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    const doDelete = async () => {
      try {
        const userId = session?.user?.id;
        if (!userId) return;

        // Delete user's posts (cascade will clean up saves, reports, etc.)
        await supabase.from('posts').delete().eq('user_id', userId);
        // Delete user's profile
        await supabase.from('profiles').delete().eq('id', userId);
        // Sign out (Supabase auth account deletion requires admin API,
        // but clearing the profile + posts + signing out effectively removes the user)
        await signOut();
        handleClose();
        setShowProfile(false);
      } catch {
        const msg = 'Could not delete account. Please try again or contact support.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Error', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('This will permanently delete your account and all your posts. This cannot be undone.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Account',
        'This will permanently delete your account and all your posts. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Mask phone number
  const maskedPhone = session?.user?.phone
    ? '•••• ' + session.user.phone.replace(/\D/g, '').slice(-4)
    : '—';

  const handleChangeable = canChangeHandle();
  const daysLeft = daysUntilHandleChange();

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { height }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={styles.backButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke="#02040F"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 64 + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Avatar ─── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={changeAvatar} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: profile?.avatar_color || '#EB736C' }]}>
                <Text style={styles.avatarInitials}>{profile?.avatar_initials || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.7}>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {saveError && (
          <TouchableOpacity onPress={() => setSaveError(null)} activeOpacity={0.7}>
            <Text style={styles.errorText}>{saveError} ✕</Text>
          </TouchableOpacity>
        )}

        {/* ─── Account ─── */}
        <SectionHeader title="ACCOUNT" />

        <View style={styles.settingGroup}>
          <EditableField
            label="Display Name"
            value={displayName}
            onSave={(v) => saveField('display_name', v)}
            placeholder="Add name"
            autoCapitalize="words"
          />
          <EditableField
            label="Handle"
            value={handle}
            onSave={(v) => saveField('handle', v)}
            placeholder="@username"
            prefix="@"
            autoCapitalize="none"
            disabled={!handleChangeable}
            disabledMessage={`You can change your handle in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
          />
          <EditableField
            label="Bio"
            value={bio}
            onSave={(v) => saveField('bio', v)}
            placeholder="Tell us about yourself"
            multiline
          />
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Phone Number</Text>
            <Text style={styles.settingValue}>{maskedPhone}</Text>
          </View>
        </View>

        {/* ─── Bio Links ─── */}
        <SectionHeader title="LINKS" />

        <View style={styles.settingGroup}>
          {bioLinks.map((link, index) => (
            <View key={index} style={styles.bioLinkRow}>
              <View style={styles.bioLinkFields}>
                <TextInput
                  style={styles.bioLinkInput}
                  value={link.label}
                  onChangeText={(v) => updateBioLink(index, 'label', v)}
                  onBlur={() => saveBioLink(index)}
                  placeholder="Label (e.g. Instagram)"
                  placeholderTextColor="rgba(2,4,15,0.3)"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.bioLinkInput}
                  value={link.url}
                  onChangeText={(v) => updateBioLink(index, 'url', v)}
                  onBlur={() => saveBioLink(index)}
                  placeholder="https://..."
                  placeholderTextColor="rgba(2,4,15,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <TouchableOpacity
                style={styles.bioLinkRemove}
                onPress={() => removeBioLink(index)}
                activeOpacity={0.6}
              >
                <Text style={styles.bioLinkRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {bioLinks.length < MAX_BIO_LINKS && (
            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.6}
              onPress={addBioLink}
            >
              <Text style={[styles.settingLabel, { color: 'rgba(2,4,15,0.5)' }]}>
                + Add link
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Preferences ─── */}
        <SectionHeader title="PREFERENCES" />

        <View style={styles.settingGroup}>
          <EditableField
            label="City"
            value={city}
            onSave={(v) => saveField('location', v)}
            placeholder="Add city"
          />
        </View>

        {/* ─── Privacy & Safety ─── */}
        <SectionHeader title="PRIVACY & SAFETY" />

        <View style={styles.settingGroup}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Private Profile</Text>
            <Switch
              value={isPrivate}
              onValueChange={togglePrivate}
              trackColor={{ true: '#78B896', false: '#ddd' }}
              thumbColor="#fff"
            />
          </View>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.6}
            onPress={() => {
              const message = 'The Pages is a community event flyer app. All posts go through AI moderation before appearing publicly.\n\nProhibited content:\n• Graphic violence or dangerous content\n• Adult or sexually explicit material\n• Hate speech or discrimination\n• Content sexualizing minors\n• Personal information (addresses, phone numbers, SSNs)\n• Spam or fake events\n\nPosts with 3+ community reports are automatically hidden pending review.\n\nTo report a DMCA takedown, contact: dmca@thepages.app';
              if (Platform.OS === 'web') {
                window.alert(message);
              } else {
                Alert.alert('Content Policy', message);
              }
            }}
          >
            <Text style={styles.settingLabel}>Content Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Account Actions ─── */}
        <SectionHeader title="" />

        <View style={styles.settingGroup}>
          <TouchableOpacity style={styles.settingRow} onPress={handleSignOut} activeOpacity={0.6}>
            <Text style={styles.settingLabel}>Sign Out</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount} activeOpacity={0.6}>
            <Text style={[styles.settingLabel, styles.destructiveText]}>Delete Account</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>The Pages v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0ECEC',
    zIndex: 110,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 2,
    color: '#02040F',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: '#ffffff',
  },
  changePhotoText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
  },

  /* Sections */
  sectionHeader: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(2,4,15,0.4)',
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 12,
    paddingLeft: 4,
  },
  settingGroup: {
    backgroundColor: '#fff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.06)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
    minHeight: 50,
  },
  settingLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
    flex: 1,
  },
  settingValue: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
    marginLeft: 12,
    maxWidth: '50%',
    textAlign: 'right',
  },
  settingValueDisabled: {
    color: 'rgba(2,4,15,0.2)',
  },
  chevron: {
    fontFamily: FONTS.body,
    fontSize: 20,
    color: 'rgba(2,4,15,0.25)',
  },

  /* Editable field */
  editableField: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
  },
  editableLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editPrefix: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: 'rgba(2,4,15,0.4)',
    marginRight: 2,
  },
  editInput: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: '#02040F',
    borderBottomWidth: 1,
    borderBottomColor: '#E9D25E',
    paddingVertical: 4,
  },
  editInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  editCancel: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  editCancelText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
  },
  editSave: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#E9D25E',
    borderRadius: 8,
  },
  editSaveText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: '#02040F',
  },

  /* Error */
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#EB736C',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  /* Bio Links */
  bioLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
    gap: 10,
  },
  bioLinkFields: {
    flex: 1,
    gap: 6,
  },
  bioLinkInput: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: '#02040F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.08)',
    paddingVertical: 4,
  },
  bioLinkRemove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioLinkRemoveText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.3)',
  },

  destructiveText: {
    color: '#EB736C',
  },
  versionText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.25)',
    textAlign: 'center',
    marginTop: 32,
  },
});
