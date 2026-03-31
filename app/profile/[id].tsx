import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import type { Profile } from '../../types';

/* ─── SVG Icons ─── */

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#02040F" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

function LinkIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
        stroke="rgba(2,4,15,0.4)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
        stroke="rgba(2,4,15,0.4)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Public profile page — viewable by anyone for public profiles.
 * Matches the same visual style as the own-profile panel (ProfilePanel).
 */
export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Community stats
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);

  // Follow state (for current user viewing this profile)
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const currentUserId = session?.user?.id;

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

        // Fetch community stats
        const [{ data: followers }, { data: following }] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', id),
          supabase.from('follows').select('following_id').eq('follower_id', id),
        ]);

        const followerIds = new Set((followers || []).map((f: any) => f.follower_id));
        const followingIds = new Set((following || []).map((f: any) => f.following_id));

        setFollowerCount(followerIds.size);
        setFollowingCount(followingIds.size);

        // Mutuals = intersection of followers and following
        let mutuals = 0;
        for (const fId of followerIds) {
          if (followingIds.has(fId)) mutuals++;
        }
        setMutualCount(mutuals);

        // Check if current user follows this profile
        if (currentUserId && currentUserId !== id) {
          const isCurrentFollowing = followerIds.has(currentUserId);
          setIsFollowing(isCurrentFollowing);
          // Check if they also follow us back
          const theyFollowUs = followingIds.has(currentUserId);
          setIsMutual(isCurrentFollowing && theyFollowUs);
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, currentUserId]);

  const handleFollow = async () => {
    if (!currentUserId || !id || followLoading) return;
    setFollowLoading(true);
    try {
      const { error: err } = await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: id,
      });
      if (err) throw err;
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    } catch {
      const msg = 'Could not follow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    if (!currentUserId || !id || followLoading) return;
    setFollowLoading(true);
    try {
      const { error: err } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: id });
      if (err) throw err;
      setIsFollowing(false);
      setIsMutual(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } catch {
      const msg = 'Could not unfollow. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
    setFollowLoading(false);
  };

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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/')}>
            <Text style={styles.browseButtonText}>BROWSE EVENTS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const thumbWidth = (width - 24 * 2 - 12) / 2;
  const thumbHeight = (thumbWidth * 4) / 3;
  const isOwnProfile = currentUserId === id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top row — back button */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButtonInline} activeOpacity={0.7} onPress={() => router.back()}>
            <BackIcon />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        {/* Profile info */}
        <View style={styles.profileInfo}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: profile.avatar_color || COLORS.red }]}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{profile.avatar_initials || '?'}</Text>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name}>{profile.display_name || profile.handle}</Text>

          {/* Handle */}
          <Text style={styles.handle}>{profile.handle}</Text>

          {/* Follow / Mutual button */}
          {!isOwnProfile && currentUserId ? (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followButtonFollowing,
              ]}
              activeOpacity={0.7}
              onPress={isFollowing ? handleUnfollow : handleFollow}
              disabled={followLoading}
            >
              <Text style={[
                styles.followButtonText,
                isFollowing && styles.followButtonTextFollowing,
              ]}>
                {isMutual ? 'MUTUALS' : isFollowing ? 'FOLLOWING' : 'FOLLOW'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Bio */}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {/* Bio Links */}
          {profile.bio_links && profile.bio_links.length > 0 ? (
            <View style={styles.bioLinksRow}>
              {profile.bio_links.filter((l: any) => l.url).map((link: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={styles.bioLinkChip}
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <LinkIcon />
                  <Text style={styles.bioLinkLabel} numberOfLines={1}>
                    {link.label || link.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

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

        {/* Posts header */}
        <View style={styles.postsHeader}>
          <Text style={styles.postsHeaderText}>POSTS</Text>
          <View style={styles.postsHeaderUnderline} />
        </View>

        {/* Post grid */}
        {posts.length > 0 ? (
          <View style={styles.grid}>
            {posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={[styles.gridItem, { width: thumbWidth, height: thumbHeight }]}
                activeOpacity={0.8}
                onPress={() => router.push(`/event/${post.id}`)}
              >
                {post.image_url ? (
                  <Image source={{ uri: post.image_url }} style={styles.gridImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.gridImage, { backgroundColor: post.bg_color || '#1a1a2e' }]} />
                )}
                <View style={styles.gridOverlay}>
                  <Text style={styles.gridTitle} numberOfLines={2}>{post.title}</Text>
                  {post.date_text ? (
                    <Text style={styles.gridDate} numberOfLines={1}>{post.date_text}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No public posts yet</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0ECEC',
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
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2,4,15,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonInline: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#02040F',
    marginBottom: 14,
  },
  followButtonFollowing: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(2,4,15,0.2)',
  },
  followButtonText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#02040F',
  },
  followButtonTextFollowing: {
    color: 'rgba(2,4,15,0.5)',
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.6)',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 10,
  },
  bioLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    maxWidth: 300,
  },
  bioLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(2,4,15,0.05)',
    borderRadius: 12,
  },
  bioLinkLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.6)',
    maxWidth: 120,
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
  postsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  postsHeaderText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#02040F',
    paddingBottom: 8,
  },
  postsHeaderUnderline: {
    width: 40,
    height: 2,
    backgroundColor: '#E9D25E',
    borderRadius: 1,
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
    letterSpacing: 1,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#E9D25E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  browseButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#02040F',
    letterSpacing: 1.5,
  },
});
