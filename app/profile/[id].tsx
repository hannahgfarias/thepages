import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
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
import type { Profile } from '../../types';

function PinIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={2}
      />
      <Circle cx={12} cy={9} r={2.5} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
    </Svg>
  );
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Public profile page — viewable by anyone for public profiles.
 * Shows profile info, follow button, stats, and their public posts.
 */
export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, isAuthenticated } = useAuth();
  const myUserId = session?.user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Stats
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .eq('is_public', true)
          .single();

        if (profileErr || !profileData) {
          setError('Profile not found');
          return;
        }
        setProfile(profileData);

        // Fetch their public posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', id)
          .eq('is_public', true)
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(30);

        setPosts(postsData || []);

        // Fetch follow stats
        const [{ data: followers }, { data: following }] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', id),
          supabase.from('follows').select('following_id').eq('follower_id', id),
        ]);

        const followerIds = new Set((followers || []).map((f: any) => f.follower_id));
        const followingIds = new Set((following || []).map((f: any) => f.following_id));

        setFollowerCount(followerIds.size);
        setFollowingCount(followingIds.size);

        // Mutuals = people in both sets
        let mutuals = 0;
        followerIds.forEach((fid) => { if (followingIds.has(fid)) mutuals++; });
        setMutualCount(mutuals);

        // Check if current user follows this profile
        if (myUserId) {
          setIsFollowing(followerIds.has(myUserId));

          // Check if this profile follows current user
          const { data: theyFollowMe } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', id)
            .eq('following_id', myUserId)
            .maybeSingle();

          setFollowsMe(!!theyFollowMe);
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
    if (!myUserId || !id) return;
    setFollowLoading(true);
    try {
      const { error: err } = await supabase.from('follows').insert({
        follower_id: myUserId,
        following_id: id,
      });
      if (err) throw err;
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      if (followsMe) setMutualCount((c) => c + 1);
    } catch {
      const msg = 'Could not follow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setFollowLoading(false);
    }
  }, [myUserId, id, followsMe]);

  const handleUnfollow = useCallback(async () => {
    if (!myUserId || !id) return;
    setFollowLoading(true);
    try {
      const { error: err } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: myUserId, following_id: id });
      if (err) throw err;
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
      if (followsMe) setMutualCount((c) => Math.max(0, c - 1));
    } catch {
      const msg = 'Could not unfollow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setFollowLoading(false);
    }
  }, [myUserId, id, followsMe]);

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
  const isMutual = isFollowing && followsMe;
  const postWidth = (width - 48) / 2;

  // Determine follow button state
  let followLabel = 'FOLLOW';
  let followStyle = styles.followButton;
  let followTextStyle = styles.followButtonText;
  if (isFollowing && followsMe) {
    followLabel = 'MUTUALS';
    followStyle = styles.followingButton;
    followTextStyle = styles.followingButtonText;
  } else if (isFollowing) {
    followLabel = 'FOLLOWING';
    followStyle = styles.followingButton;
    followTextStyle = styles.followingButtonText;
  } else if (followsMe) {
    followLabel = 'FOLLOW BACK';
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back button */}
      <TouchableOpacity style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <BackIcon />
      </TouchableOpacity>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        ListHeaderComponent={
          <View style={styles.header}>
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

            {/* Follow button — only show if not own profile */}
            {!isOwnProfile && (
              <TouchableOpacity
                style={[followStyle, followLoading && { opacity: 0.5 }]}
                activeOpacity={0.7}
                disabled={followLoading}
                onPress={isFollowing ? handleUnfollow : handleFollow}
              >
                <Text style={followTextStyle}>{followLabel}</Text>
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

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>POSTS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{followerCount}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{mutualCount}</Text>
                <Text style={styles.statLabel}>MUTUALS</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No public posts yet</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.postCard, { width: postWidth, backgroundColor: item.bg_color || '#1a1a2e' }]}
            activeOpacity={0.8}
            onPress={() => {
              router.push(`/event/${item.id}`);
            }}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={styles.postImagePlaceholder}>
                <Text style={[styles.postTitle, { color: item.text_color || '#fff' }]} numberOfLines={3}>
                  {item.title}
                </Text>
              </View>
            )}
            <View style={styles.postInfo}>
              <Text style={styles.postInfoTitle} numberOfLines={1}>{item.title}</Text>
              {item.date_text ? <Text style={styles.postInfoDate} numberOfLines={1}>{item.date_text}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: '#fff',
    letterSpacing: 1,
  },
  displayName: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  handle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  // Follow button styles
  followButton: {
    backgroundColor: COLORS.red,
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
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 0,
    marginBottom: 16,
  },
  followingButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#fff',
    letterSpacing: 0.5,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#fff',
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
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postCard: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  postImagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 5,
    padding: 12,
    justifyContent: 'center',
  },
  postTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postInfo: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  postInfoTitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  postInfoDate: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});
