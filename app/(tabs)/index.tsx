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
import { FlyerCard } from '../../components/FlyerCard';
import { useFlyers, parseEventDate } from '../../hooks/useFlyers';
import { useOverlay } from './_layout';
import { useAuth } from '../../hooks/useAuth';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import type { Post } from '../../types';

const NAV_HEIGHT = 64;

/* ─── Magnifying Glass Icon ─── */

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke="#02040F" strokeWidth={2} />
      <Path
        d="M20 20l-4-4"
        stroke="#02040F"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ─── Feed Screen ─── */

export default function FeedScreen() {
  const { user } = useAuth();
  const { flyers, loading, error, toggleSave, recordShare, refetch } = useFlyers(user?.id);
  const { setShowSearch, setShowProfile, showProfile, showAddEvent, searchFilters, setSearchFilters, setShowAuthPrompt, setEditingPost, setShowAddEvent } = useOverlay();
  const prevShowAddEvent = useRef(false);

  // Refetch feed when AddEventSheet closes (post was potentially added)
  useEffect(() => {
    if (prevShowAddEvent.current && !showAddEvent) {
      refetch();
    }
    prevShowAddEvent.current = showAddEvent;
  }, [showAddEvent, refetch]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardHeight = height - NAV_HEIGHT - insets.bottom;

  // Tag filtering
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredFlyers = flyers.filter((f) => {
    // Tag filter
    if (activeTag && !f.tags?.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
      return false;
    }

    // Search filters
    if (searchFilters) {
      // Text query
      if (searchFilters.query) {
        const q = searchFilters.query.toLowerCase();
        const match = [f.title, f.subtitle, f.location, f.date_text, f.category, ...(f.tags || [])]
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
          // Swipe left → open profile
          setShowProfile(true);
        }
      },
    })
  ).current;

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
            {/* Wordmark */}
            <Text style={styles.wordmark}>THE PAGES</Text>

            {/* Search button */}
            <TouchableOpacity style={styles.searchButton} activeOpacity={0.7} onPress={() => setShowSearch(true)}>
              <SearchIcon />
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
          <TouchableOpacity style={styles.stateButton} activeOpacity={0.7} onPress={refetch}>
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
          <Text style={styles.stateTitle}>No events found</Text>
          <Text style={styles.stateSubtitle}>
            {activeTag ? `No events with ${activeTag}` : searchFilters ? 'Try adjusting your filters' : 'Check back soon for new events'}
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
          ListFooterComponent={
            <View style={[styles.endOfFeed, { height: cardHeight }]}>
              <Text style={styles.endOfFeedEmoji}>✨</Text>
              <Text style={styles.endOfFeedTitle}>You've seen it all</Text>
              <Text style={styles.endOfFeedSubtitle}>
                {filteredFlyers.length} event{filteredFlyers.length !== 1 ? 's' : ''} in your feed
              </Text>
              <TouchableOpacity style={styles.stateButton} activeOpacity={0.7} onPress={refetch}>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#02040F',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.15)',
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
