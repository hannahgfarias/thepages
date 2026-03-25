import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  SectionList,
  Alert,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface CommunityMember {
  id: string;
  name: string;
  handle: string;
  color: string;
  initials: string;
  status: 'mutual' | 'following' | 'follows_you';
}

export function CommunitySheet() {
  const { showCommunity, setShowCommunity } = useOverlay();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(false);

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  const userId = session?.user?.id;

  const fetchCommunity = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch people I follow
      const { data: following } = await supabase
        .from('follows')
        .select('following_id, profile:profiles!follows_following_id_fkey(id, handle, display_name, avatar_color, avatar_initials)')
        .eq('follower_id', userId);

      // Fetch people who follow me
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id, profile:profiles!follows_follower_id_fkey(id, handle, display_name, avatar_color, avatar_initials)')
        .eq('following_id', userId);

      const followingIds = new Set((following || []).map((f: any) => f.following_id));
      const followerIds = new Set((followers || []).map((f: any) => f.follower_id));

      const allProfiles = new Map<string, any>();

      // Map following
      for (const f of (following || [])) {
        const p = f.profile;
        if (!p) continue;
        const isMutual = followerIds.has(p.id);
        allProfiles.set(p.id, {
          id: p.id,
          name: p.display_name || p.handle || 'User',
          handle: p.handle || '@user',
          color: p.avatar_color || '#EB736C',
          initials: p.avatar_initials || '?',
          status: isMutual ? 'mutual' : 'following',
        });
      }

      // Map followers not already in the list
      for (const f of (followers || [])) {
        const p = f.profile;
        if (!p || allProfiles.has(p.id)) continue;
        allProfiles.set(p.id, {
          id: p.id,
          name: p.display_name || p.handle || 'User',
          handle: p.handle || '@user',
          color: p.avatar_color || '#EB736C',
          initials: p.avatar_initials || '?',
          status: 'follows_you',
        });
      }

      setMembers(Array.from(allProfiles.values()));
    } catch (e) {
      console.warn('Community fetch error:', e);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (showCommunity) {
      fetchCommunity();
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
  }, [showCommunity, slideY, scrimOpacity, height, fetchCommunity]);

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
      setShowCommunity(false);
    });
  };

  const handleFollow = async (targetId: string, targetName: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: userId,
        following_id: targetId,
      });
      if (error) throw error;

      // Update local state
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === targetId) {
            // Check if they already follow us — if so, now mutual
            return { ...m, status: m.status === 'follows_you' ? 'mutual' : 'following' };
          }
          return m;
        })
      );

      const msg = `You're now following ${targetName}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Following', msg);
    } catch {
      const msg = 'Could not follow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const handleUnfollow = async (targetId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: userId, following_id: targetId });
      if (error) throw error;

      // Update local state
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === targetId) {
            return { ...m, status: m.status === 'mutual' ? 'follows_you' : 'follows_you' };
          }
          return m;
        }).filter((m) => m.status !== 'follows_you' || m.id === targetId)
      );
    } catch {
      const msg = 'Could not unfollow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const STATUS_LABELS: Record<string, string> = {
    mutual: 'Community',
    following: 'Following',
    follows_you: 'Follows you',
  };

  const mutuals = members.filter((m) => m.status === 'mutual');
  const others = members.filter((m) => m.status !== 'mutual');

  const sections = [
    ...(mutuals.length > 0 ? [{ title: 'YOUR COMMUNITY', data: mutuals }] : []),
    ...(others.length > 0 ? [{ title: 'CONNECTIONS', data: others }] : []),
  ];

  const renderItem = ({ item }: { item: CommunityMember }) => (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, { backgroundColor: item.color }]}>
        <Text style={styles.memberInitials}>{item.initials}</Text>
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberHandle}>{item.handle}</Text>
      </View>

      {item.status === 'follows_you' ? (
        <TouchableOpacity
          style={styles.followBackButton}
          activeOpacity={0.7}
          onPress={() => handleFollow(item.id, item.name)}
        >
          <Text style={styles.followBackText}>FOLLOW BACK</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
        </View>
      )}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  if (!showCommunity) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            maxHeight: height * 0.75,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>COMMUNITY</Text>
          <TouchableOpacity style={styles.closeButton} activeOpacity={0.7} onPress={handleClose}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#02040F" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(2,4,15,0.3)" />
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No connections yet</Text>
            <Text style={styles.emptySubtext}>Follow people to build your community</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 200,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0ECEC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 201,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(2,4,15,0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 24,
    width: 28,
    height: 28,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.15)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: '#02040F',
  },
  emptySubtext: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#ffffff',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#02040F',
    fontWeight: '600',
  },
  memberHandle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.35)',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.12)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(2,4,15,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followBackButton: {
    borderWidth: 1,
    borderColor: '#02040F',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  followBackText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#02040F',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
