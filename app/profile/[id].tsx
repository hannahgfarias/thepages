import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import { FlyerCard } from '../../components/FlyerCard';
import type { Profile, Post } from '../../types';

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

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#02040F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const NAV_HEIGHT = 64;

export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { session, isAuthenticated } = useAuth();
  const myUserId = session?.user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Whether I'm an accepted follower (for private profile gate)
  const [isAcceptedFollower, setIsAcceptedFollower] = useState(false);

  // Stats
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);

  // Post viewer
  const [viewerPosts, setViewerPosts] = useState<any[] | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const viewerCardHeight = height - NAV_HEIGHT - insets.bottom;

  // Grid dimensions
  const thumbWidth = (width - 48 - 12) / 2;
  const thumbHeight = thumbWidth * 1.25;

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);

        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (profileErr || !profileData) {
          setError('Profile not found');
          return;
        }
        setProfile(profileData);

        // Fetch follow stats (only accepted follows)
        const [{ data: followers }, { data: following }] = await Promise.all([
          supabase.from('follows').select('follower_id, status').eq('following_id', id),
          supabase.from('follows').select('following_id, status').eq('follower_id', id),
        ]);

        const acceptedFollowerIds = new Set(
          (followers || []).filter((f: any) => f.status === 'accepted').map((f: any) => f.follower_id)
        );
        const acceptedFollowingIds = new Set(
          (following || []).filter((f: any) => f.status === 'accepted').map((f: any) => f.following_id)
        );

        setFollowerCount(acceptedFollowerIds.size);
        setFollowingCount(acceptedFollowingIds.size);

        let mutuals = 0;
        acceptedFollowerIds.forEach((fid) => { if (acceptedFollowingIds.has(fid)) mutuals++; });
        setMutualCount(mutuals);

        if (myUserId) {
          const myFollow = (followers || []).find((f: any) => f.follower_id === myUserId);
          if (myFollow) {
            setIsFollowing(true);
            setFollowPending(myFollow.status === 'pending');
            setIsAcceptedFollower(myFollow.status === 'accepted');
          } else {
            setIsFollowing(false);
            setFollowPending(false);
            setIsAcceptedFollower(false);
          }

          const { data: theyFollowMe } = await supabase
            .from('follows')
            .select('id, status')
            .eq('follower_id', id)
            .eq('following_id', myUserId)
            .eq('status', 'accepted')
            .maybeSingle();

          setFollowsMe(!!theyFollowMe);
        }

        const isOwner = myUserId === id;
        const viewerIsAccepted = myUserId
          ? (followers || []).some((f: any) => f.follower_id === myUserId && f.status === 'accepted')
          : false;

        if (profileData.is_public || isOwner || viewerIsAccepted) {
          const { data: postsData } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', id)
            .eq('moderation_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(30);

          setPosts(postsData || []);
        } else {
          setPosts([]);
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, myUserId]);

  const handleFollow = useCallback(async () => {
    if (!myUserId || !id || !profile) return;
    setFollowLoading(true);
    try {
      const status = profile.is_public ? 'accepted' : 'pending';
      const { error: err } = await supabase.from('follows').insert({
        follower_id: myUserId,
        following_id: id,
        status,
      });
      if (err) throw err;
      setIsFollowing(true);
      setFollowPending(status === 'pending');
      if (status === 'accepted') {
        setIsAcceptedFollower(true);
        setFollowerCount((c) => c + 1);
        if (followsMe) setMutualCount((c) => c + 1);
      }
    } catch {
      const msg = 'Could not follow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setFollowLoading(false);
    }
  }, [myUserId, id, profile, followsMe]);

  const handleUnfollow = useCallback(async () => {
    if (!myUserId || !id) return;
    setFollowLoading(true);
    try {
      const { error: err } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: myUserId, following_id: id });
      if (err) throw err;
      const wasPending = followPending;
      setIsFollowing(false);
      setFollowPending(false);
      setIsAcceptedFollower(false);
      if (!wasPending) {
        setFollowerCount((c) => Math.max(0, c - 1));
        if (followsMe) setMutualCount((c) => Math.max(0, c - 1));
      }
    } catch {
      const msg = 'Could not unfollow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setFollowLoading(false);
    }
  }, [myUserId, id, followsMe, followPending]);

  const openPostViewer = useCallback((postList: any[], index: number) => {
    setViewerPosts(postList);
    setViewerInitialIndex(index);
  }, []);

  const closePostViewer = useCallback(() => {
    setViewerPosts(null);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.red} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/')}>
          <Text style={styles.browseButtonText}>BROWSE EVENTS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProfile = myUserId === id;
  const isMutual = isFollowing && !followPending && followsMe;
  const isPrivateAndGated = !profile.is_public && !isOwnProfile && !isAcceptedFollower;
  const communityCount = followerCount + followingCount + mutualCount;

  // Determine follow button state
  let followLabel = 'FOLLOW';
  let followBtnStyle: any = styles.followButton;
  let followTxtStyle: any = styles.followButtonText;

  if (followPending) {
    followLabel = 'REQUESTED';
    followBtnStyle = styles.requestedButton;
    followTxtStyle = styles.requestedButtonText;
  } else if (isMutual) {
    followLabel = 'MUTUALS';
    followBtnStyle = styles.mutualsButton;
    followTxtStyle = styles.mutualsButtonText;
  } else if (isFollowing) {
    followLabel = 'FOLLOWING';
    followBtnStyle = styles.followingButton;
    followTxtStyle = styles.followingButtonText;
  } else if (followsMe) {
    followLabel = 'FOLLOW BACK';
    followBtnStyle = styles.followBackButton;
    followTxtStyle = styles.followBackButtonText;
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <BackIcon />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile info */}
        <View style={styles.profileInfo}>
          {/* Avatar */}
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: profile.avatar_color || '#EB736C' }]}>
              <Text style={styles.avatarInitials}>{profile.avatar_initials || '?'}</Text>
            </View>
          )}

          {/* Name & handle */}
          <Text style={styles.displayName}>{profile.display_name || profile.handle}</Text>
          <Text style={styles.handle}>{profile.handle}</Text>

          {/* Follow button */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={[followBtnStyle, followLoading && { opacity: 0.5 }]}
              activeOpacity={0.7}
              disabled={followLoading}
              onPress={isFollowing ? handleUnfollow : handleFollow}
            >
              <Text style={followTxtStyle}>{followLabel}</Text>
            </TouchableOpacity>
          )}

          {/* Bio */}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {/* Location */}
          {profile.location ? (
            <View style={styles.locationRow}>
              <PinIcon />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{communityCount}</Text>
            <Text style={styles.statLabel}>COMMUNITY</Text>
          </View>
        </View>

        {/* Private profile gate */}
        {isPrivateAndGated && (
          <View style={styles.privateGate}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
                stroke="rgba(2,4,15,0.3)"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.privateGateTitle}>PRIVATE PROFILE</Text>
            <Text style={styles.privateGateText}>
              Follow this account to see their posts
            </Text>
          </View>
        )}

        {/* Post grid */}
        {!isPrivateAndGated && posts.length > 0 && (
          <View style={styles.grid}>
            {posts.map((post, index) => {
              const imageSource = post.image_url ? { uri: post.image_url } : null;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.gridItem, { width: thumbWidth, height: thumbHeight }]}
                  activeOpacity={0.8}
                  onPress={() => openPostViewer(posts, index)}
                >
                  {imageSource ? (
                    <Image source={imageSource} style={styles.gridImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.gridImage, { backgroundColor: post.bg_color || '#1a1a2e' }]} />
                  )}
                  <View style={styles.gridOverlay}>
                    <Text style={styles.gridTitle} numberOfLines={2}>{post.title}</Text>
                    {post.date_text ? <Text style={styles.gridDate} numberOfLines={1}>{post.date_text}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!isPrivateAndGated && posts.length === 0 && (
          <Text style={styles.emptyText}>No posts yet</Text>
        )}
      </ScrollView>

      {/* Fullscreen post viewer */}
      {viewerPosts && (
        <View style={styles.viewerOverlay}>
          <TouchableOpacity
            style={[styles.viewerClose, { top: insets.top + 12 }]}
            activeOpacity={0.7}
            onPress={closePostViewer}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <FlatList
            data={viewerPosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FlyerCard
                flyer={item}
                cardHeight={viewerCardHeight}
              />
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            initialScrollIndex={viewerInitialIndex}
            getItemLayout={(_, index) => ({
              length: viewerCardHeight,
              offset: viewerCardHeight * index,
              index,
            })}
            onScrollToIndexFailed={() => {}}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0ECEC',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2,4,15,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: '#fff',
    letterSpacing: 1,
  },
  displayName: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: '#02040F',
    marginBottom: 4,
  },
  handle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 12,
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.6)',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 10,
    lineHeight: 20,
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
  // Follow button styles
  followButton: {
    backgroundColor: COLORS.followState,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  followButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  followBackButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.followState,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  followBackButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.followState,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.followState,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  followingButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.followState,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  requestedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.followState,
    borderStyle: 'dashed' as any,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  requestedButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.followState,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  mutualsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.mutuals,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  mutualsButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.mutuals,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // Stats
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
  // Private profile gate
  privateGate: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  privateGateTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: 'rgba(2,4,15,0.5)',
    letterSpacing: 2,
  },
  privateGateText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.3)',
    textAlign: 'center',
  },
  // Post grid
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
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#02040F',
    textAlign: 'center',
    marginTop: 80,
    letterSpacing: 1,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'center',
  },
  browseButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1.5,
  },
  // Fullscreen post viewer
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    zIndex: 50,
  },
  viewerClose: {
    position: 'absolute',
    left: 16,
    zIndex: 60,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
