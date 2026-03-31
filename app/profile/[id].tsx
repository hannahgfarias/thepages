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

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
        stroke="rgba(2,4,15,0.35)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Profile page — handles both public and private profiles.
 * Public profiles: PUBLIC tab (public posts) + PRIVATE tab (followers/mutuals posts)
 * Private profiles: header only, "Private Profile" message, follow request system
 */
export default function PublicProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [publicPosts, setPublicPosts] = useState<any[]>([]);
  const [privatePosts, setPrivatePosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  // Community stats
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);

  // Follow state (for current user viewing this profile)
  const [followState, setFollowState] = useState<'none' | 'pending' | 'following' | 'mutual'>('none');
  const [followLoading, setFollowLoading] = useState(false);

  // Relationship: can the viewer see private posts?
  const [canSeeFollowerPosts, setCanSeeFollowerPosts] = useState(false);
  const [canSeeMutualPosts, setCanSeeMutualPosts] = useState(false);

  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // Fetch profile (both public and private — we show header for both)
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

        // Fetch community stats (only accepted follows)
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

        // Mutuals = intersection
        let mutuals = 0;
        for (const fId of acceptedFollowerIds) {
          if (acceptedFollowingIds.has(fId)) mutuals++;
        }
        setMutualCount(mutuals);

        // Determine current user's relationship with this profile
        let viewerIsFollower = false;
        let viewerIsMutual = false;

        if (currentUserId && currentUserId !== id) {
          // Check if we follow them
          const ourFollow = (followers || []).find((f: any) => f.follower_id === currentUserId);
          // Check if they follow us
          const theyFollowUs = acceptedFollowingIds.has(currentUserId);

          if (ourFollow) {
            if (ourFollow.status === 'pending') {
              setFollowState('pending');
            } else if (ourFollow.status === 'accepted') {
              viewerIsFollower = true;
              if (theyFollowUs) {
                viewerIsMutual = true;
                setFollowState('mutual');
              } else {
                setFollowState('following');
              }
            }
          } else {
            setFollowState('none');
          }
        }

        setCanSeeFollowerPosts(viewerIsFollower);
        setCanSeeMutualPosts(viewerIsMutual);

        // For public profiles, fetch public posts always
        if (profileData.is_public) {
          const { data: pubPosts } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', id)
            .eq('post_visibility', 'public')
            .eq('moderation_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(30);
          setPublicPosts(pubPosts || []);

          // Fetch private posts the viewer has access to
          // RLS will enforce visibility — just fetch non-public posts
          if (currentUserId) {
            const { data: privPosts } = await supabase
              .from('posts')
              .select('*')
              .eq('user_id', id)
              .neq('post_visibility', 'public')
              .eq('moderation_status', 'approved')
              .order('created_at', { ascending: false })
              .limit(30);
            setPrivatePosts(privPosts || []);
          }
        } else if (viewerIsFollower) {
          // Private profile but we're an accepted follower — can see their posts based on RLS
          const { data: allPosts } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', id)
            .eq('moderation_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(30);

          const pub = (allPosts || []).filter((p: any) => p.post_visibility === 'public');
          const priv = (allPosts || []).filter((p: any) => p.post_visibility !== 'public');
          setPublicPosts(pub);
          setPrivatePosts(priv);
        }
        // If private profile and not a follower — no posts fetched (gate shown)
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
      // Private profiles require approval
      const isPending = profile && !profile.is_public;
      const status = isPending ? 'pending' : 'accepted';

      const { error: err } = await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: id,
        status,
      });
      if (err) throw err;

      if (isPending) {
        setFollowState('pending');
        const msg = 'Follow request sent';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Request Sent', msg);
      } else {
        setFollowState('following');
        setFollowerCount((c) => c + 1);
        setCanSeeFollowerPosts(true);
      }
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
      setFollowState('none');
      setCanSeeFollowerPosts(false);
      setCanSeeMutualPosts(false);
      setFollowerCount((c) => Math.max(0, c - 1));
      setPrivatePosts([]);
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
  const isPrivateProfile = !profile.is_public;
  const isProfileGated = isPrivateProfile && !canSeeFollowerPosts && !isOwnProfile;

  // Follow button label
  const followButtonLabel = (() => {
    switch (followState) {
      case 'mutual': return 'MUTUALS';
      case 'following': return 'FOLLOWING';
      case 'pending': return 'REQUESTED';
      default: return 'FOLLOW';
    }
  })();

  // Has private posts worth showing in the tab?
  const hasPrivatePosts = privatePosts.length > 0;

  const renderPostGrid = (posts: any[]) => (
    <View style={styles.grid}>
      {posts.map((post: any) => (
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
  );

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

          {/* Follow / Mutual / Requested button */}
          {!isOwnProfile && currentUserId ? (
            <TouchableOpacity
              style={[
                styles.followButton,
                followState !== 'none' && styles.followButtonFollowing,
                followState === 'pending' && styles.followButtonPending,
              ]}
              activeOpacity={0.7}
              onPress={followState === 'none' ? handleFollow : handleUnfollow}
              disabled={followLoading}
            >
              <Text style={[
                styles.followButtonText,
                followState !== 'none' && styles.followButtonTextFollowing,
              ]}>
                {followButtonLabel}
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
            <Text style={styles.statNumber}>{publicPosts.length + privatePosts.length}</Text>
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

        {/* ─── Private profile gate ─── */}
        {isProfileGated ? (
          <View style={styles.privateGate}>
            <LockIcon />
            <Text style={styles.privateGateTitle}>Private Profile</Text>
            <Text style={styles.privateGateText}>
              {followState === 'pending'
                ? 'Your follow request is pending. You\'ll see their posts once they accept.'
                : 'Follow this account to see their posts.'}
            </Text>
          </View>
        ) : (
          <>
            {/* ─── Tabs: PUBLIC / PRIVATE ─── */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={styles.tab}
                activeOpacity={0.7}
                onPress={() => setActiveTab('public')}
              >
                <Text style={[styles.tabText, activeTab === 'public' && styles.tabTextActive]}>
                  PUBLIC
                </Text>
                {activeTab === 'public' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>

              {(hasPrivatePosts || isOwnProfile) && (
                <TouchableOpacity
                  style={styles.tab}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab('private')}
                >
                  <Text style={[styles.tabText, activeTab === 'private' && styles.tabTextActive]}>
                    PRIVATE
                  </Text>
                  {activeTab === 'private' && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              )}
            </View>

            {/* ─── Tab content ─── */}
            {activeTab === 'public' ? (
              publicPosts.length > 0 ? (
                renderPostGrid(publicPosts)
              ) : (
                <Text style={styles.emptyText}>No public posts yet</Text>
              )
            ) : (
              privatePosts.length > 0 ? (
                renderPostGrid(privatePosts)
              ) : (
                <Text style={styles.emptyText}>No private posts visible</Text>
              )
            )}
          </>
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
  followButtonPending: {
    borderColor: 'rgba(2,4,15,0.15)',
    borderStyle: 'dashed',
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

  /* Tabs */
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

  /* Private profile gate */
  privateGate: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  privateGateTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: '#02040F',
    letterSpacing: 1,
  },
  privateGateText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.5)',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  /* Post grid */
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
