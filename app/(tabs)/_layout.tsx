import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import { useAuth as useAuthContext } from '../../hooks/useAuth';

/* ─── Overlay Components ─── */
import { SearchOverlay } from '../../components/SearchOverlay';
import { AddEventSheet } from '../../components/AddEventSheet';
import { ReportSheet } from '../../components/ReportSheet';
import { ProfilePanel } from '../../components/ProfilePanel';
import { CommunitySheet } from '../../components/CommunitySheet';
import { AuthFlow } from '../../components/AuthFlow';
import { AuthPrompt } from '../../components/AuthPrompt';
import { WelcomeScreen } from '../../components/WelcomeScreen';
// TermsAgeGate is now inside AuthPrompt — shown when user taps Sign Up

/* ─── Overlay Context ─── */

// SearchFilters type — defined here to avoid circular imports
export interface SearchFilters {
  query: string;
  types: string[];
  when: string | null;
  locations: string[] | string | null;
  customDate?: string;
}

interface OverlayState {
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  showAddEvent: boolean;
  setShowAddEvent: (v: boolean) => void;
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  showReport: boolean;
  setShowReport: (v: boolean) => void;
  showCommunity: boolean;
  setShowCommunity: (v: boolean) => void;
  showAuth: boolean;
  setShowAuth: (v: boolean) => void;
  showAuthPrompt: boolean;
  setShowAuthPrompt: (v: boolean) => void;
  searchFilters: SearchFilters | null;
  setSearchFilters: (f: SearchFilters | null) => void;
}

export const OverlayContext = createContext<OverlayState>({
  showSearch: false,
  setShowSearch: () => {},
  showAddEvent: false,
  setShowAddEvent: () => {},
  showProfile: false,
  setShowProfile: () => {},
  showReport: false,
  setShowReport: () => {},
  showCommunity: false,
  setShowCommunity: () => {},
  showAuth: false,
  setShowAuth: () => {},
  showAuthPrompt: false,
  setShowAuthPrompt: () => {},
  searchFilters: null,
  setSearchFilters: () => {},
});

export function useOverlay() {
  return useContext(OverlayContext);
}

function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [showSearch, setShowSearch] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);

  const value = useMemo(
    () => ({
      showSearch,
      setShowSearch,
      showAddEvent,
      setShowAddEvent,
      showProfile,
      setShowProfile,
      showReport,
      setShowReport,
      showCommunity,
      setShowCommunity,
      showAuth,
      setShowAuth,
      showAuthPrompt,
      setShowAuthPrompt,
      searchFilters,
      setSearchFilters,
    }),
    [
      showSearch,
      showAddEvent,
      showProfile,
      showReport,
      showCommunity,
      showAuth,
      showAuthPrompt,
      searchFilters,
    ]
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
}

/* ─── SVG Icons ─── */

function BrowseIcon({ active }: { active: boolean }) {
  const color = active ? '#02040F' : 'rgba(2,4,15,0.35)';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Rect x={1} y={1} width={8} height={8} rx={2} fill={color} />
      <Rect x={13} y={1} width={8} height={8} rx={2} fill={color} />
      <Rect x={1} y={13} width={8} height={8} rx={2} fill={color} />
      <Rect x={13} y={13} width={8} height={8} rx={2} fill={color} />
    </Svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? '#02040F' : 'rgba(2,4,15,0.35)';
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={7} r={4} fill={color} />
      <Path
        d="M3 19c0-4.418 3.582-8 8-8s8 3.582 8 8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ─── Custom Tab Bar ─── */

function CustomTabBar({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { showProfile, setShowAddEvent, setShowProfile, setShowAuthPrompt } = useOverlay();
  const { isAuthenticated } = useAuthContext();
  const isProfileActive = showProfile;
  const isBrowseActive = !isProfileActive;

  return (
    <View
      style={[
        styles.navBar,
        {
          paddingBottom: insets.bottom,
          height: 64 + insets.bottom,
        },
        Platform.OS === 'web' && styles.navBarWeb,
      ]}
    >
      {/* Browse */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => {
          if (isProfileActive) setShowProfile(false);
        }}
      >
        <BrowseIcon active={isBrowseActive} />
        <Text
          style={[
            styles.navLabel,
            { color: isBrowseActive ? '#02040F' : 'rgba(2,4,15,0.35)' },
          ]}
        >
          Browse
        </Text>
      </TouchableOpacity>

      {/* Add Event (red circle) */}
      <TouchableOpacity
        style={styles.navItemCenter}
        activeOpacity={0.8}
        onPress={() => {
          if (!isAuthenticated) {
            setShowAuthPrompt(true);
          } else {
            setShowAddEvent(true);
          }
        }}
      >
        <View style={styles.addButton}>
          <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
            <Path
              d="M11 4v14M4 11h14"
              stroke="#ffffff"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => {
          if (!isAuthenticated) {
            setShowAuthPrompt(true);
          } else {
            setShowProfile(true);
          }
        }}
      >
        <ProfileIcon active={isProfileActive} />
        <Text style={[styles.navLabel, { color: isProfileActive ? '#02040F' : 'rgba(2,4,15,0.35)' }]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Storage Keys ─── */

const WELCOME_SEEN_KEY = 'the_pages_welcome_seen';

/* ─── Connected Search (uses overlay context) ─── */

function ConnectedSearchOverlay() {
  const { setSearchFilters } = useOverlay();
  return <SearchOverlay onApplyFilters={(filters) => setSearchFilters(filters)} />;
}

/* ─── Tab Layout ─── */

export default function TabLayout() {
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    // On web, try localStorage first (AsyncStorage can be flaky on web)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const seen = window.localStorage.getItem(WELCOME_SEEN_KEY);
      setShowWelcome(seen !== 'true');
    } else {
      AsyncStorage.getItem(WELCOME_SEEN_KEY).then((value) => {
        setShowWelcome(value !== 'true');
      }).catch(() => setShowWelcome(true));
    }
  }, []);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } else {
      AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
    }
  };

  return (
    <OverlayProvider>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
      </Tabs>

      {/* Overlay stack — render order matters (later = higher z-index) */}
      <ConnectedSearchOverlay />
      <AddEventSheet />
      <ReportSheet />
      <ProfilePanel />
      <CommunitySheet />
      <AuthPrompt />
      <AuthFlow />

      {/* Welcome screen — shows on first launch */}
      {showWelcome && <WelcomeScreen onDismiss={handleDismissWelcome} />}
    </OverlayProvider>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.navBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.navBorder,
    zIndex: 200,
    elevation: 200,
  },
  navBarWeb: {
    // @ts-ignore — web-only CSS property
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as any,
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 4,
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  navLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
