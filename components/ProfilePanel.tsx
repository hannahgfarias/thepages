import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { useFlyers } from '../hooks/useFlyers';
import { useAuth } from '../hooks/useAuth';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';
import type { Post } from '../types';
import { SettingsSheet } from './SettingsSheet';
import { useCommunityData } from './CommunitySheet';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

/* ─── Date parsing helper ─── */

const MONTH_MAP: Record<string, number> = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
  JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11,
  JAN: 0, FEB: 1, MAR: 2, APR: 3, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Parse date_text like "MARCH 19", "SUNDAY MARCH 29 · 5PM-9ISH",
 * "MARCH 19 · DOORS 10PM", "COMING 2024" etc. into a Date object.
 * Returns null if unparseable. Assumes current year for month+day patterns.
 */
function parseDateText(dateText: string | null): Date | null {
  if (!dateText) return null;
  const upper = dateText.toUpperCase();

  // Try to find MONTH DAY pattern
  for (const [monthName, monthIndex] of Object.entries(MONTH_MAP)) {
    const regex = new RegExp(`${monthName}\\s+(\\d{1,2})`);
    const match = upper.match(regex);
    if (match) {
      const day = parseInt(match[1], 10);
      const now = new Date();
      return new Date(now.getFullYear(), monthIndex, day);
    }
  }

  return null;
}

type DateSection = 'HAPPENING TODAY' | 'THIS WEEK' | 'UPCOMING' | 'PAST';

function categorizePosts(posts: Post[]): Record<DateSection, Post[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // End of current week (Sunday)
  const dayOfWeek = today.getDay();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));

  const sections: Record<DateSection, Post[]> = {
    'HAPPENING TODAY': [],
    'THIS WEEK': [],
    'UPCOMING': [],
    'PAST': [],
  };

  for (const post of posts) {
    const eventDate = parseDateText(post.date_text);
    if (!eventDate) {
      // If we can't parse the date, put in UPCOMING
      sections['UPCOMING'].push(post);
      continue;
    }

    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    if (eventDay.getTime() === today.getTime()) {
      sections['HAPPENING TODAY'].push(post);
    } else if (eventDay < today) {
      sections['PAST'].push(post);
    } else if (eventDay <= endOfWeek) {
      sections['THIS WEEK'].push(post);
    } else {
      sections['UPCOMING'].push(post);
    }
  }

  return sections;
}

/* ─── SVG Icons ─── */

function GearIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke="#02040F" strokeWidth={1.8} />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="#02040F"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PinIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke="rgba(2,4,15,0.5)"
        strokeWidth={2}
      />
      <Circle cx={12} cy={9} r={2.5} stroke="rgba(2,4,15,0.5)" strokeWidth={2} />
    </Svg>
  );
}

/* ─── ProfilePanel Component ─── */

export function ProfilePanel() {
  const { showProfile, setShowProfile, setShowCommunity } = useOverlay();
  const { profile, isAuthenticated, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [showSettings, setShowSettings] = useState(false);

  const translateX = useRef(new Animated.Value(width)).current;
  // Track if we're currently dragging to skip animation
  const isDragging = useRef(false);

  useEffect(() => {
    if (showProfile) {
      translateX.setValue(width);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        easing: EASING,
        useNativeDriver: true,
      }).start();
    }
  }, [showProfile, translateX, width]);

  const close = () => {
    Animated.timing(translateX, {
      toValue: width,
      duration: 350,
      easing: EASING,
      useNativeDriver: true,
    }).start(() => {
      setShowProfile(false);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          gestureState.dx > 0
        );
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;
        if (gestureState.dx > 60 || gestureState.vx > 0.5) {
          close();
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 250,
            easing: EASING,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const { flyers: allFlyers } = useFlyers();
  const { requests: communityRequests } = useCommunityData();
  const userId = session?.user?.id;

  // Your posts — filter all flyers by current user
  const yourPosts = useMemo(() =>
    allFlyers.filter((f) => f.user_id === userId),
    [allFlyers, userId]
  );

  // Saved posts — filter all flyers that are saved
  const savedPosts = useMemo(() =>
    allFlyers.filter((f) => f.is_saved),
    [allFlyers]
  );

  const savedByDate = useMemo(() => categorizePosts(savedPosts), [savedPosts]);

  const thumbWidth = (width - 24 * 2 - 12) / 2;
  const thumbHeight = (thumbWidth * 4) / 3;

  const sectionOrder: DateSection[] = ['HAPPENING TODAY', 'THIS WEEK', 'UPCOMING', 'PAST'];

  // Auto-close profile panel when user signs out
  useEffect(() => {
    if (showProfile && !isAuthenticated) {
      setShowProfile(false);
    }
  }, [isAuthenticated, showProfile, setShowProfile]);

  // Never show profile panel if not authenticated
  if (!showProfile || !isAuthenticated) return null;

  const renderPostGrid = (posts: Post[]) => (
    <View style={styles.grid}>
      {posts.map((post) => {
        const imageSource = post.image
          ? post.image
          : post.image_url
          ? { uri: post.image_url }
          : null;

        return (
          <View
            key={post.id}
            style={[
              styles.gridItem,
              { width: thumbWidth, height: thumbHeight },
            ]}
          >
            {imageSource ? (
              <Image
                source={imageSource}
                style={styles.gridImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.gridImage,
                  { backgroundColor: post.bgColor },
                ]}
              />
            )}
            {/* Gradient overlay at bottom */}
            <View style={styles.gridOverlay}>
              <Text style={styles.gridTitle} numberOfLines={2}>
                {post.title}
              </Text>
              <Text style={styles.gridDate} numberOfLines={1}>
                {post.date_text}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateX }] },
      ]}
      {...panResponder.panHandlers}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 64 + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings gear — top right */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.gearButton} activeOpacity={0.7} onPress={() => setShowSettings(true)}>
            <GearIcon />
          </TouchableOpacity>
        </View>

        {/* Profile info */}
        <View style={styles.profileInfo}>
          {/* Avatar */}
          <View style={[styles.avatar, profile?.avatar_color ? { backgroundColor: profile.avatar_color } : null]}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>
                {profile?.avatar_initials || '?'}
              </Text>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name}>
            {profile?.display_name || (isAuthenticated ? 'New User' : 'Guest')}
          </Text>

          {/* Handle */}
          <Text style={styles.handle}>
            {profile?.handle || (isAuthenticated ? '@user' : 'Sign up to get started')}
          </Text>

          {/* Bio */}
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {/* Location */}
          {profile?.location ? (
            <View style={styles.locationRow}>
              <PinIcon />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{yourPosts.length}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{savedPosts.length}</Text>
            <Text style={styles.statLabel}>SAVED</Text>
          </View>
          <TouchableOpacity
            style={styles.stat}
            activeOpacity={0.7}
            onPress={() => setShowCommunity(true)}
          >
            <View style={styles.communityStatRow}>
              <Text style={styles.statNumber}>0</Text>
              {communityRequests.length > 0 && (
                <View style={styles.requestNotifBadge}>
                  <Text style={styles.requestNotifText}>{communityRequests.length}</Text>
                </View>
              )}
              <Text style={styles.communityArrow}>{'\u203A'}</Text>
            </View>
            <Text style={styles.statLabel}>COMMUNITY</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => setActiveTab('posts')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'posts' && styles.tabTextActive,
              ]}
            >
              YOUR POSTS
            </Text>
            {activeTab === 'posts' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => setActiveTab('saved')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'saved' && styles.tabTextActive,
              ]}
            >
              SAVED
            </Text>
            {activeTab === 'saved' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'posts' ? (
          /* Posts — flat grid */
          renderPostGrid(yourPosts)
        ) : (
          /* Saved — grouped by date */
          <View>
            {sectionOrder.map((sectionKey) => {
              const sectionPosts = savedByDate[sectionKey];
              if (!sectionPosts || sectionPosts.length === 0) return null;

              return (
                <View key={sectionKey}>
                  <Text style={styles.dateSectionHeader}>{sectionKey}</Text>
                  {renderPostGrid(sectionPosts)}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Animated.View>

    {/* Settings — rendered outside the profile panel so it gets full screen */}
    {showSettings && (
      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 64, // Leave room for the tab bar
    backgroundColor: '#F0ECEC',
    zIndex: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  gearButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: '#ffffff',
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: '#02040F',
    marginBottom: 4,
  },
  handle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 10,
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.6)',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.5)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#02040F',
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(2,4,15,0.5)',
  },
  communityStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityArrow: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: 'rgba(2,4,15,0.5)',
    marginTop: -2,
  },
  requestNotifBadge: {
    backgroundColor: '#E9D25E',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  requestNotifText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#02040F',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    justifyContent: 'center',
  },
  tab: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(2,4,15,0.35)',
  },
  tabTextActive: {
    color: '#02040F',
  },
  tabUnderline: {
    width: '100%',
    height: 2,
    backgroundColor: '#E9D25E',
    borderRadius: 1,
    marginTop: 6,
  },
  /* Date section headers */
  dateSectionHeader: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(2,4,15,0.45)',
    marginBottom: 12,
    marginTop: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 30,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gridTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gridDate: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
