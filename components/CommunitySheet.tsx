import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Alert,
  Platform,
  PanResponder,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
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
  avatarUrl: string | null;
  status: 'mutual' | 'following' | 'follows_you' | 'pending_request';
}

export function CommunitySheet() {
  const { showCommunity, setShowCommunity } = useOverlay();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  const userId = session?.user?.id;

  // Max height: never cover full screen — always leave top 15% visible
  const sheetMaxHeight = height * 0.82 - insets.top;

  const fetchCommunity = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch people I follow (with status)
      const { data: following } = await supabase
        .from('follows')
        .select('following_id, status, profile:profiles!follows_following_id_fkey(id, handle, display_name, avatar_color, avatar_initials, avatar_url)')
        .eq('follower_id', userId);

      // Fetch people who follow me (with status)
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id, status, profile:profiles!follows_follower_id_fkey(id, handle, display_name, avatar_color, avatar_initials, avatar_url)')
        .eq('following_id', userId);

      // Only count accepted follows for relationship status
      const acceptedFollowingIds = new Set(
        (following || []).filter((f: any) => f.status === 'accepted').map((f: any) => f.following_id)
      );
      const acceptedFollowerIds = new Set(
        (followers || []).filter((f: any) => f.status === 'accepted').map((f: any) => f.follower_id)
      );

      const allProfiles = new Map<string, CommunityMember>();

      // People I follow (accepted)
      for (const f of (following || [])) {
        if (f.status !== 'accepted') continue;
        const p = f.profile;
        if (!p) continue;
        const isMutual = acceptedFollowerIds.has(p.id);
        allProfiles.set(p.id, {
          id: p.id,
          name: p.display_name || p.handle || 'User',
          handle: p.handle || '@user',
          color: p.avatar_color || '#EB736C',
          initials: p.avatar_initials || '?',
          avatarUrl: p.avatar_url || null,
          status: isMutual ? 'mutual' : 'following',
        });
      }

      // People who follow me (accepted) but I don't follow back
      for (const f of (followers || [])) {
        if (f.status !== 'accepted') continue;
        const p = f.profile;
        if (!p || allProfiles.has(p.id)) continue;
        allProfiles.set(p.id, {
          id: p.id,
          name: p.display_name || p.handle || 'User',
          handle: p.handle || '@user',
          color: p.avatar_color || '#EB736C',
          initials: p.avatar_initials || '?',
          avatarUrl: p.avatar_url || null,
          status: 'follows_you',
        });
      }

      // Pending follow requests (people who want to follow me, status='pending')
      for (const f of (followers || [])) {
        if (f.status !== 'pending') continue;
        const p = f.profile;
        if (!p || allProfiles.has(p.id)) continue;
        allProfiles.set(p.id, {
          id: p.id,
          name: p.display_name || p.handle || 'User',
          handle: p.handle || '@user',
          color: p.avatar_color || '#EB736C',
          initials: p.avatar_initials || '?',
          avatarUrl: p.avatar_url || null,
          status: 'pending_request',
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
      setCollapsedSections({});
      fetchCommunity();
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
  }, [showCommunity, slideY, scrimOpacity, height, fetchCommunity]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 220,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 180,
        easing: EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCommunity(false);
    });
  }, [slideY, scrimOpacity, height, setShowCommunity]);

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          slideY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          handleClose();
        } else {
          Animated.timing(slideY, {
            toValue: 0,
            duration: 200,
            easing: EASING,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Open a user's full profile page
  const openProfile = useCallback((member: CommunityMember) => {
    handleClose();
    setTimeout(() => {
      router.push(`/profile/${member.id}`);
    }, 250);
  }, [handleClose, router]);

  const handleFollow = async (targetId: string, targetName: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: userId,
        following_id: targetId,
        status: 'accepted', // Follow-back is always accepted
      });
      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === targetId) {
            return { ...m, status: m.status === 'follows_you' ? 'mutual' : 'following' };
          }
          return m;
        })
      );
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

      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === targetId) {
            return m.status === 'mutual' ? { ...m, status: 'follows_you' as const } : null;
          }
          return m;
        }).filter(Boolean) as CommunityMember[]
      );
    } catch {
      const msg = 'Could not unfollow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  // Accept a pending follow request
  const handleAcceptRequest = async (requesterId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('follows')
        .update({ status: 'accepted' })
        .match({ follower_id: requesterId, following_id: userId });
      if (error) throw error;

      // Check if I also follow them (making us mutual)
      const { data: iFollowThem } = await supabase
        .from('follows')
        .select('id')
        .match({ follower_id: userId, following_id: requesterId, status: 'accepted' })
        .maybeSingle();

      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === requesterId) {
            return { ...m, status: iFollowThem ? 'mutual' : 'follows_you' };
          }
          return m;
        })
      );
    } catch {
      const msg = 'Could not accept request. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  // Decline a pending follow request
  const handleDeclineRequest = async (requesterId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: requesterId, following_id: userId });
      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== requesterId));
    } catch {
      const msg = 'Could not decline request. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const pendingRequests = members.filter((m) => m.status === 'pending_request');
  const followsYou = members.filter((m) => m.status === 'follows_you');
  const mutuals = members.filter((m) => m.status === 'mutual');
  const following = members.filter((m) => m.status === 'following');

  const sections = [
    ...(pendingRequests.length > 0 ? [{ title: `PENDING REQUESTS (${pendingRequests.length})`, data: pendingRequests }] : []),
    ...(followsYou.length > 0 ? [{ title: 'FOLLOWERS', data: followsYou }] : []),
    ...(mutuals.length > 0 ? [{ title: 'YOUR MUTUALS', data: mutuals }] : []),
    ...(following.length > 0 ? [{ title: 'FOLLOWING', data: following }] : []),
  ];

  const renderMember = (item: CommunityMember) => (
    <View key={item.id} style={styles.memberRow}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
        activeOpacity={0.7}
        onPress={() => openProfile(item)}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={[styles.memberAvatar, { backgroundColor: item.color }]} />
        ) : (
          <View style={[styles.memberAvatar, { backgroundColor: item.color }]}>
            <Text style={styles.memberInitials}>{item.initials}</Text>
          </View>
        )}
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberHandle}>{item.handle}</Text>
        </View>
      </TouchableOpacity>

      {item.status === 'pending_request' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={styles.acceptButton}
            activeOpacity={0.7}
            onPress={() => handleAcceptRequest(item.id)}
          >
            <Text style={styles.acceptButtonText}>ACCEPT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineButton}
            activeOpacity={0.7}
            onPress={() => handleDeclineRequest(item.id)}
          >
            <Text style={styles.declineButtonText}>DECLINE</Text>
          </TouchableOpacity>
        </View>
      ) : item.status === 'follows_you' ? (
        <TouchableOpacity
          style={styles.followBackBtn}
          activeOpacity={0.7}
          onPress={() => handleFollow(item.id, item.name)}
        >
          <Text style={styles.followBackBtnText}>FOLLOW BACK</Text>
        </TouchableOpacity>
      ) : item.status === 'mutual' ? (
        <TouchableOpacity
          style={styles.mutualsBadge}
          activeOpacity={0.7}
          onPress={() => handleUnfollow(item.id)}
        >
          <Text style={styles.mutualsBadgeText}>MUTUALS</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.followingBadge}
          activeOpacity={0.7}
          onPress={() => handleUnfollow(item.id)}
        >
          <Text style={styles.followingBadgeText}>FOLLOWING</Text>
        </TouchableOpacity>
      )}
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
            maxHeight: sheetMaxHeight,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Drag handle — swipe down to close */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>COMMUNITY</Text>
          </View>
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {sections.map((section) => {
              const isCollapsed = collapsedSections[section.title] || false;
              return (
                <View key={section.title}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    activeOpacity={0.7}
                    onPress={() => toggleSection(section.title)}
                  >
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionChevron}>{isCollapsed ? '›' : '‹'}</Text>
                  </TouchableOpacity>
                  {!isCollapsed && section.data.map((item) => renderMember(item))}
                </View>
              );
            })}
          </ScrollView>
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
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(2,4,15,0.15)',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 2,
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
    justifyContent: 'space-between',
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
  sectionChevron: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: 'rgba(2,4,15,0.3)',
    transform: [{ rotate: '-90deg' }],
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
  // Coral — following / follow back (outlined, black text)
  followingBadge: {
    borderWidth: 1.5,
    borderColor: COLORS.followState,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  followingBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followBackBtn: {
    backgroundColor: COLORS.followState,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  followBackBtnText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#02040F',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Custard — mutuals (outlined, black text)
  mutualsBadge: {
    borderWidth: 1.5,
    borderColor: COLORS.mutuals,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mutualsBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Accept / Decline for pending requests
  acceptButton: {
    backgroundColor: COLORS.followState,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  acceptButtonText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  declineButton: {
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.15)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  declineButtonText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: 'rgba(2,4,15,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
