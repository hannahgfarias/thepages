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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/* ─── Section Header ─── */
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

/* ─── Setting Row ─── */
function SettingRow({
  label,
  value,
  onPress,
  trailing,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      disabled={!onPress && !trailing}
    >
      <Text style={[styles.settingLabel, destructive && styles.destructiveText]}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.settingValue}>{value}</Text>
      ) : trailing ? (
        trailing
      ) : onPress ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

/* ─── Settings Sheet ─── */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { signOut } = useAuth();

  // Animation
  const translateX = useRef(new Animated.Value(height)).current;

  // Settings state
  const [displayName, setDisplayName] = useState('Hannah');
  const [handle, setHandle] = useState('@hannahgfarias');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('San Francisco, CA');
  const [isPrivate, setIsPrivate] = useState(false);
  const [notifyNewEvents, setNotifyNewEvents] = useState(true);
  const [notifySaves, setNotifySaves] = useState(true);
  const [notifyCommunity, setNotifyCommunity] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

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

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            handleClose();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your posts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: call delete account API
            handleClose();
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Your data export will be sent to your email address.');
  };

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
      >
        {/* ─── Account ─── */}
        <SectionHeader title="ACCOUNT" />

        <View style={styles.settingGroup}>
          <SettingRow
            label="Display Name"
            value={displayName}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Alert.prompt('Display Name', 'Enter your display name', (text) => { if (text) setDisplayName(text); }, 'plain-text', displayName);
              } else {
                setEditingField('name');
              }
            }}
          />
          <SettingRow
            label="Handle"
            value={handle}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Alert.prompt('Handle', 'Enter your handle (starts with @)', (text) => { if (text) setHandle(text.startsWith('@') ? text : '@' + text); }, 'plain-text', handle);
              } else {
                setEditingField('handle');
              }
            }}
          />
          <SettingRow
            label="Bio"
            value={bio || 'Add a bio'}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Alert.prompt('Bio', 'Tell the community about yourself', (text) => setBio(text || ''), 'plain-text', bio);
              } else {
                setEditingField('bio');
              }
            }}
          />
          <SettingRow
            label="Phone Number"
            value="•••• 8720"
            onPress={() => Alert.alert('Change Phone', 'To change your phone number, you\'ll need to verify your new number.')}
          />
        </View>

        {/* ─── Preferences ─── */}
        <SectionHeader title="PREFERENCES" />

        <View style={styles.settingGroup}>
          <SettingRow
            label="City"
            value={city}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Alert.prompt('City', 'Enter your city', (text) => { if (text) setCity(text); }, 'plain-text', city);
              } else {
                setEditingField('city');
              }
            }}
          />
          <SettingRow
            label="New Events Near You"
            trailing={
              <Switch
                value={notifyNewEvents}
                onValueChange={setNotifyNewEvents}
                trackColor={{ true: '#78B896', false: '#ddd' }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            label="When Someone Saves Your Post"
            trailing={
              <Switch
                value={notifySaves}
                onValueChange={setNotifySaves}
                trackColor={{ true: '#78B896', false: '#ddd' }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            label="Community Updates"
            trailing={
              <Switch
                value={notifyCommunity}
                onValueChange={setNotifyCommunity}
                trackColor={{ true: '#78B896', false: '#ddd' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ─── Privacy & Safety ─── */}
        <SectionHeader title="PRIVACY & SAFETY" />

        <View style={styles.settingGroup}>
          <SettingRow
            label="Private Profile"
            trailing={
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ true: '#78B896', false: '#ddd' }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            label="Blocked Users"
            onPress={() => Alert.alert('Blocked Users', 'No blocked users yet.')}
          />
          <SettingRow
            label="Content Policy"
            onPress={() => Alert.alert('Content Policy', 'The Pages is committed to a safe community. See our full policy at thepages.app/policy.')}
          />
          <SettingRow
            label="Export My Data"
            onPress={handleExportData}
          />
        </View>

        {/* ─── Account Actions ─── */}
        <SectionHeader title="" />

        <View style={styles.settingGroup}>
          <SettingRow
            label="Sign Out"
            onPress={handleSignOut}
          />
          <SettingRow
            label="Delete Account"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>

        {/* Version */}
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
  },
  chevron: {
    fontFamily: FONTS.body,
    fontSize: 20,
    color: 'rgba(2,4,15,0.25)',
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
