import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  PanResponder,
  useWindowDimensions,
  ViewToken,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { FlyerCard } from '../../components/FlyerCard';
import { useSharedFlyers, parseEventDate } from '../../hooks/useFlyers';
import { useOverlay } from './_layout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import type { Post } from '../../types';

type FeedTab = 'following' | 'mutuals' | 'all';

/** Returns true if a hex color is light (needs dark text on top) */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

const NAV_HEIGHT = 64;

/* ─── Magnifying Glass Icon ─── */

function SearchIcon({ color = '#02040F' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path
        d="M20 20l-4-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ─── Feed Screen ─── */

export default function FeedScreen() {
  const { user } = useAuth();
  const { flyers, loading, error, toggleSave, recordShare, refetch } = useSharedFlyers();
  const { setShowSearch, setShowProfile, showProfile, showAddEvent, searchFilters, setSearchFilters, setShowAuthPrompt, setEditingPost, setShowAddEvent, scrollToTopRef, focusPostId, setFocusPostId } = useOverlay();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const flatListRef = useRef<FlatList>(null);
  const [refreshing, setRefreshing] = useState(false);
  const prevShowAddEvent = useRef(false);
  const [activeTopTab, setActiveTopTab] = useState<'mutuals' | 'following' | 'all'>('all');

  // Register scroll-to-top
  useEffect(() => {
    scrollToTopRef.current = () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };
    return () => { scrollToTopRef.current = null; };
  }, [scrollToTopRef]);

  // Handle deep link: ?focus={postId} from /event/[id] redirect
  useEffect(() => {
    if (focus) {
      setFocusPostId(focus);
    }
  }, [focus, setFocusPostId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Refetch feed when AddEventSheet closes (post was potentially added) and scroll to top
  useEffect(() => {
    if (prevShowAddEvent.current && !showAddEvent) {
      refetch();
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    prevShowAddEvent.current = showAddEvent;
  }, [showAddEvent, refetch]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardHeight = height - NAV_HEIGHT - insets.bottom;

  // Scroll to a specific post when focusPostId is set (e.g. tapping a saved post)
  useEffect(() => {
    if (focusPostId && filteredFlyersRef.current.length > 0) {
      const index = filteredFlyersRef.current.findIndex((f) => f.id === focusPostId);
      if (index >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true });
        }, 450); // wait for profile panel close animation
      }
      setFocusPostId(null);
    }
  }, [focusPostId, setFocusPostId]);

  // Feed tabs: Following / Mutuals / All
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());

  // Fetch follow graph for the current user
  useEffect(() => {
    if (!user?.id) {
      setFollowingIds(new Set());
      setMutualIds(new Set());
      return;
    }

    const fetchFollows = async () => {
      // People I follow
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const iFollow = new Set<string>((myFollows || []).map((f: any) => f.following_id));
      setFollowingIds(iFollow);

      // People who follow me
      const { data: theirFollows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      const followMe = new Set<string>((theirFollows || []).map((f: any) => f.follower_id));

      // Mutuals = mutual follows
      const mutual = new Set<string>();
      iFollow.forEach((id) => {
        if (followMe.has(id)) mutual.add(id);
      });
      setMutualIds(mutual);
    };

    fetchFollows();
  }, [user?.id]);

  // Tag filtering
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredFlyers = flyers.filter((f) => {
    // Feed tab filter (using follow graph) — only show posts from people in that group
    if (activeTopTab === 'following' && user?.id) {
      if (!followingIds.has(f.user_id)) return false;
    } else if (activeTopTab === 'mutuals' && user?.id) {
      if (!mutualIds.has(f.user_id)) return false;
    }

    // Tag filter
    if (activeTag && !f.tags?.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
      return false;
    }

    // Search filters
    if (searchFilters) {
      // Text query
      if (searchFilters.query) {
        const q = searchFilters.query.toLowerCase();
        const match = [f.title, f.subtitle, f.description, f.location, f.date_text, f.category, ...(f.tags || []),
          f.profile?.handle, f.profile?.display_name]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q));
        if (!match) return false;
      }

      // Type filter
      if (searchFilters.types.length > 0) {
        const categoryMatch = searchFilters.types.some(
          (t) => f.category.toLowerCase().includes(t.toLowerCase())
        );
        if (!categoryMatch) return false;
      }

      // Location filter
      const locs = searchFilters.locations;
      if (locs) {
        const loc = (Array.isArray(locs) ? locs[0] : locs)?.toLowerCase() || '';
        if (loc && loc !== 'near me') {
          const flyerLoc = (f.location || '').toLowerCase();
          const locAliases: Record<string, string[]> = {
            sf: ['sf', 'san francisco', 's.f.'],
            oakland: ['oakland'],
            la: ['los angeles', 'la', 'l.a.'],
            nyc: ['new york', 'nyc', 'ny', 'brooklyn', 'manhattan', 'queens', 'bronx'],
          };
          const aliases = locAliases[loc] || [loc];
          const locMatch = aliases.some((a) => flyerLoc.includes(a));
          if (!locMatch) return false;
        }
      }

      // When filter
      if (searchFilters.when) {
        const eventDate = parseEventDate(f.date_text || '');
        if (eventDate) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const todayEnd = new Date(todayStart.getTime() + 86400000);
          const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

          // Find next weekend (Saturday start)
          const dayOfWeek = todayStart.getDay();
          const satStart = new Date(todayStart.getTime() + ((6 - dayOfWeek) % 7) * 86400000);
          const sunEnd = new Date(satStart.getTime() + 2 * 86400000);

          switch (searchFilters.when) {
            case 'Happening Now':
            case 'Today':
              if (eventDate < todayStart || eventDate >= todayEnd) return false;
              break;
            case 'This Week':
              if (eventDate < todayStart || eventDate >= weekEnd) return false;
              break;
            case 'This Weekend':
              if (eventDate < satStart || eventDate >= sunEnd) return false;
              break;
            case 'This Month':
              if (eventDate < todayStart || eventDate >= monthEnd) return false;
              break;
            case 'Pick a Date':
              if (searchFilters.customDate) {
                const custom = new Date(searchFilters.customDate);
                if (!isNaN(custom.getTime())) {
                  const customStart = new Date(custom.getFullYear(), custom.getMonth(), custom.getDate());
                  const customEnd = new Date(customStart.getTime() + 86400000);
                  if (eventDate < customStart || eventDate >= customEnd) return false;
                }
              }
              break;
          }
        } else {
          // No parseable date — exclude from date-filtered results
          return false;
        }
      }
    }

    return true;
  });

  const filteredFlyersRef = useRef(filteredFlyers);
  filteredFlyersRef.current = filteredFlyers;

  const handleTagPress = useCallback((tag: string) => {
    setActiveTag(tag);
  }, []);

  // Swipe left to open profile, swipe right to close (if somehow open)
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 30 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80) {
          // Swipe left → open profile (or auth prompt if not logged in)
          setShowProfile(true);
        }
      },
    })
  ).current;

  // Track current visible flyer for adaptive header colors
  const [currentFlyerIndex, setCurrentFlyerIndex] = useState(0);
  // Directional haptics tracking
  const previousIndex = useRef(0);
  // Swipe hint animation
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintTranslateY = useRef(new Animated.Value(0)).current;

  // Top bar hide-on-scroll-down / show-on-scroll-up
  const topBarTranslateY = useRef(new Animated.Value(0)).current;

  // Hide top bar when card details are showing
  const [cardActive, setCardActive] = useState(false);

  const handleCardActiveChange = useCallback((isActive: boolean) => {
    setCardActive(isActive);
    Animated.timing(topBarTranslateY, {
      toValue: isActive ? -(insets.top + 60) : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [topBarTranslateY, insets.top]);
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('up');

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const direction = currentY > lastScrollY.current ? 'down' : 'up';
      lastScrollY.current = currentY;

      if (direction !== scrollDirection.current) {
        scrollDirection.current = direction;
        Animated.timing(topBarTranslateY, {
          toValue: direction === 'down' ? -(insets.top + 60) : 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    },
    [topBarTranslateY, insets.top]
  );

  useEffect(() => {
    // Pulse animation for swipe hint
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintTranslateY, {
          toValue: -8,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(hintTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Fade out after 4 seconds
    const fadeTimer = setTimeout(() => {
      pulse.stop();
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      pulse.stop();
    };
  }, [hintOpacity, hintTranslateY]);

  const { isAuthenticated } = useAuth();

  const handleSave = useCallback((id: string) => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    toggleSave(id);
  }, [toggleSave, isAuthenticated, setShowAuthPrompt]);

  const handleShare = useCallback((id: string) => {
    recordShare(id);
  }, [recordShare]);

  const handleEdit = useCallback((post: Post) => {
    setEditingPost(post);
    setShowAddEvent(true);
  }, [setEditingPost, setShowAddEvent]);

  const handleDelete = useCallback((id: string) => {
    refetch();
  }, [refetch]);

  // Re-fetch when user logs in so saved state is loaded
  useEffect(() => {
    if (user?.id) {
      refetch();
    }
  }, [user?.id, refetch]);

  // Fire directional haptics
  const fireDirectionalHaptic = useCallback(
    (direction: 'down' | 'up') => {
      if (Platform.OS === 'web') {
        return;
      }
      try {
        if (direction === 'down') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
            30
          );
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
            60
          );
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
            30
          );
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
            60
          );
        }
      } catch {
        // Haptics not available
      }
    },
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const newIndex = viewableItems[0].index;
        setCurrentFlyerIndex(newIndex);
        if (newIndex !== previousIndex.current) {
          const direction = newIndex > previousIndex.current ? 'down' : 'up';
          fireDirectionalHaptic(direction);
          previousIndex.current = newIndex;
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <FlyerCard flyer={item} cardHeight={cardHeight} onSave={handleSave} onShare={handleShare} onActiveChange={handleCardActiveChange} onTagPress={handleTagPress} onEdit={handleEdit} onDelete={handleDelete} />
    ),
    [cardHeight, handleSave, handleShare, handleCardActiveChange, handleTagPress, handleEdit, handleDelete]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: cardHeight,
      offset: cardHeight * index,
      index,
    }),
    [cardHeight]
  );

  // Determine header text color based on current flyer's background
  const currentFlyer = filteredFlyers[currentFlyerIndex];
  const flyerBg = currentFlyer?.bgColor || currentFlyer?.image_url ? '#1a1a2e' : '#F0ECEC';
  const headerUseDark = currentFlyer?.image_url ? false : isLightColor(currentFlyer?.bgColor || '#F0ECEC');
  const headerColor = headerUseDark ? '#02040F' : '#ffffff';
  const headerInactiveColor = headerUseDark ? 'rgba(2,4,15,0.35)' : 'rgba(255,255,255,0.5)';

  return (
    <View style={styles.container} {...swipePanResponder.panHandlers}>
      {/* Top bar — hidden when card details are active */}
      {!cardActive && (
        <Animated.View
          style={[styles.topBar, { paddingTop: insets.top + 8, transform: [{ translateY: topBarTranslateY }] }]}
          pointerEvents="box-none"
        >
          <View style={styles.topBarGradient} />
          <View style={styles.topBarContent}>
            {/* TikTok-style centered tabs */}
            <View style={styles.topTabs}>
              {(['mutuals', 'following', 'all'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={styles.topTab}
                  activeOpacity={0.7}
                  onPress={() => {
                    if ((tab === 'mutuals' || tab === 'following') && !isAuthenticated) {
                      setShowAuthPrompt(true);
                      return;
                    }
                    setActiveTopTab(tab);
                  }}
                >
                  <Text style={[styles.topTabText, { color: activeTopTab === tab ? headerColor : headerInactiveColor }]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  {activeTopTab === tab && <View style={[styles.topTabIndicator, { backgroundColor: headerColor }]} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Search icon — no background */}
            <TouchableOpacity style={styles.searchButton} activeOpacity={0.7} onPress={() => setShowSearch(true)}>
              <SearchIcon color={headerColor} />
            </TouchableOpacity>
          </View>

          {/* Tag filter bar */}
          {activeTag && (
            <View style={styles.tagFilterBar}>
              <Text style={styles.tagFilterLabel}>Showing: {activeTag}</Text>
              <TouchableOpacity
                style={styles.tagFilterReset}
                activeOpacity={0.7}
                onPress={() => setActiveTag(null)}
              >
                <Text style={styles.tagFilterResetText}>SHOW ALL</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search filter bar */}
          {!activeTag && searchFilters && (
            <View style={styles.tagFilterBar}>
              <Text style={styles.tagFilterLabel}>
                Filtered{searchFilters.query ? `: "${searchFilters.query}"` : ''}
                {searchFilters.types.length > 0 ? ` · ${searchFilters.types.join(', ')}` : ''}
                {searchFilters.when ? ` · ${searchFilters.when}` : ''}
                {searchFilters.locations ? ` · ${Array.isArray(searchFilters.locations) ? searchFilters.locations[0] : searchFilters.locations}` : ''}
              </Text>
              <TouchableOpacity
                style={styles.tagFilterReset}
                activeOpacity={0.7}
                onPress={() => setSearchFilters(null)}
              >
                <Text style={styles.tagFilterResetText}>CLEAR</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}

      {/* Error state */}
      {error && filteredFlyers.length === 0 && (
        <View style={[styles.stateContainer, { height: cardHeight }]}>
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={10} stroke="rgba(2,4,15,0.15)" strokeWidth={1.5} />
            <Path d="M12 8v4M12 16h.01" stroke="rgba(2,4,15,0.3)" strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.stateButton} activeOpacity={0.7} onPress={async () => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            await refetch();
          }}>
            <Text style={styles.stateButtonText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state — no results from filters */}
      {!error && !loading && filteredFlyers.length === 0 && (
        <View style={[styles.stateContainer, { height: cardHeight }]}>
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={7} stroke="rgba(2,4,15,0.15)" strokeWidth={1.5} />
            <Path d="M20 20l-4-4" stroke="rgba(2,4,15,0.15)" strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.stateTitle}>
            {activeTopTab === 'following' ? 'No one followed yet'
              : activeTopTab === 'mutuals' ? 'No mutuals yet'
              : 'No events found'}
          </Text>
          <Text style={styles.stateSubtitle}>
            {activeTopTab === 'following'
              ? 'Follow people to see their events here'
              : activeTopTab === 'mutuals'
              ? 'Follow people back to see their events here'
              : activeTag ? `No events with ${activeTag}`
              : searchFilters ? 'Try adjusting your filters'
              : 'Check back soon for new events'}
          </Text>
          {(activeTag || searchFilters) && (
            <TouchableOpacity
              style={styles.stateButton}
              activeOpacity={0.7}
              onPress={() => { setActiveTag(null); setSearchFilters(null); }}
            >
              <Text style={styles.stateButtonText}>CLEAR FILTERS</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Loading state */}
      {loading && filteredFlyers.length === 0 && (
        <View style={[styles.stateContainer, { height: cardHeight }]}>
          <Text style={styles.stateTitle}>Loading events...</Text>
        </View>
      )}

      {/* Feed */}
      {filteredFlyers.length > 0 && (
        <FlatList
          ref={flatListRef}
          data={filteredFlyers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS !== 'web'}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListFooterComponent={
            <View style={[styles.endOfFeed, { height: cardHeight }]}>
              <Text style={styles.endOfFeedEmoji}>✨</Text>
              <Text style={styles.endOfFeedTitle}>You've seen it all</Text>
              <Text style={styles.endOfFeedSubtitle}>
                {filteredFlyers.length} event{filteredFlyers.length !== 1 ? 's' : ''} in your feed
              </Text>
              <TouchableOpacity style={styles.stateButton} activeOpacity={0.7} onPress={async () => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                await refetch();
              }}>
                <Text style={styles.stateButtonText}>REFRESH</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Swipe hint */}
      <Animated.View
        style={[
          styles.swipeHint,
          {
            bottom: 16,
            opacity: hintOpacity,
            transform: [{ translateY: hintTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12l7 7 7-7"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.swipeHintText}>Swipe up</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0ECEC',
  },

  /* Top bar */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topBarGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTabs: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  topTab: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  topTabText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1,
    color: 'rgba(2,4,15,0.35)',
  },
  topTabTextActive: {
    color: '#02040F',
  },
  topTabIndicator: {
    width: 20,
    height: 2,
    backgroundColor: '#02040F',
    borderRadius: 1,
    marginTop: 4,
  },
  searchButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Swipe hint */
  swipeHint: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 4,
    zIndex: 5,
  },
  swipeHintText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },

  /* State screens (empty, error, loading) */
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
    backgroundColor: '#F0ECEC',
  },
  stateTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: 1,
    color: '#02040F',
    textAlign: 'center',
    marginTop: 8,
  },
  stateSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
  stateButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#02040F',
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  stateButtonText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#02040F',
    textTransform: 'uppercase',
  },

  /* End of feed */
  endOfFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
    backgroundColor: '#F0ECEC',
  },
  endOfFeedEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  endOfFeedTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: 1,
    color: '#02040F',
    textAlign: 'center',
  },
  endOfFeedSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(2,4,15,0.35)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  /* Tag filter bar */
  tagFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(240,236,236,0.92)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.08)',
  },
  tagFilterLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#02040F',
    flex: 1,
  },
  tagFilterReset: {
    backgroundColor: '#02040F',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 100,
    marginLeft: 10,
  },
  tagFilterResetText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    letterSpacing: 1,
    color: '#fff',
    textTransform: 'uppercase',
  },
});
