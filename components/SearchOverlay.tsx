import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  FlatList,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { useOverlay } from '../app/(tabs)/_layout';
import { useSharedFlyers, parseEventDate } from '../hooks/useFlyers';
import { FlyerCard } from './FlyerCard';
import type { Post, Profile } from '../types';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

const EVENT_TYPES = [
  'Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre',
  'Fitness', 'Nightlife', 'Volunteer', 'Sports', 'Tech', 'Film', 'Comedy',
  'Markets', 'Workshop', 'Other',
];
const WHEN_OPTIONS = ['Happening Now', 'Today', 'This Week', 'This Weekend', 'This Month', 'Pick a Date'];
const LOCATIONS = ['SF', 'Oakland', 'LA', 'NYC', 'Near Me'];

export interface SearchFilters {
  query: string;
  types: string[];
  when: string | null;
  locations: string[] | string | null;
  customDate?: string;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SearchIcon({ size = 40, color = 'rgba(2,4,15,0.25)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function filterFlyers(filters: SearchFilters, allFlyers: Post[]) {
  return allFlyers.filter((flyer) => {
    // Query filter — also matches poster handle/display_name
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchesQuery =
        flyer.title.toLowerCase().includes(q) ||
        (flyer.subtitle && flyer.subtitle.toLowerCase().includes(q)) ||
        (flyer.location && flyer.location.toLowerCase().includes(q)) ||
        (flyer.date_text && flyer.date_text.toLowerCase().includes(q)) ||
        flyer.category.toLowerCase().includes(q) ||
        flyer.tags.some((t) => t.toLowerCase().includes(q)) ||
        (flyer.profile?.handle && flyer.profile.handle.toLowerCase().includes(q)) ||
        (flyer.profile?.display_name && flyer.profile.display_name.toLowerCase().includes(q));
      if (!matchesQuery) return false;
    }

    // Type filter
    if (filters.types.length > 0) {
      const categoryUpper = flyer.category.toUpperCase();
      const matchesType = filters.types.some((type) =>
        categoryUpper.includes(type.toUpperCase())
      );
      if (!matchesType) return false;
    }

    // Location filter
    if (filters.locations) {
      const loc = (Array.isArray(filters.locations) ? filters.locations[0] : filters.locations)?.toLowerCase() || '';
      if (loc && loc !== 'near me') {
        const flyerLoc = (flyer.location || '').toLowerCase();
        const locAliases: Record<string, string[]> = {
          sf: ['sf', 'san francisco', 's.f.'],
          oakland: ['oakland'],
          la: ['los angeles', 'la', 'l.a.'],
          nyc: ['new york', 'nyc', 'ny', 'brooklyn', 'manhattan', 'queens', 'bronx'],
        };
        const aliases = locAliases[loc] || [loc];
        if (!aliases.some((a) => flyerLoc.includes(a))) return false;
      }
    }

    // When filter
    if (filters.when) {
      const eventDate = parseEventDate(flyer.date_text || '');
      if (eventDate) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86400000);
        const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const dayOfWeek = todayStart.getDay();
        const satStart = new Date(todayStart.getTime() + ((6 - dayOfWeek) % 7) * 86400000);
        const sunEnd = new Date(satStart.getTime() + 2 * 86400000);

        switch (filters.when) {
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
            if (filters.customDate) {
              const custom = new Date(filters.customDate);
              if (!isNaN(custom.getTime())) {
                const customStart = new Date(custom.getFullYear(), custom.getMonth(), custom.getDate());
                const customEnd = new Date(customStart.getTime() + 86400000);
                if (eventDate < customStart || eventDate >= customEnd) return false;
              }
            }
            break;
        }
      } else {
        return false;
      }
    }

    return true;
  });
}

interface SearchOverlayProps {
  onApplyFilters?: (filters: SearchFilters) => void;
}

export function SearchOverlay({ onApplyFilters }: SearchOverlayProps) {
  const { showSearch, setShowSearch } = useOverlay();
  const { flyers: allFlyers } = useSharedFlyers();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedWhen, setSelectedWhen] = useState<string | null>('Happening Now');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // User search
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const userSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Public profile viewer
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [viewingUserPosts, setViewingUserPosts] = useState<Post[]>([]);
  const [loadingUserPosts, setLoadingUserPosts] = useState(false);

  // Live user search — local first, then Supabase
  useEffect(() => {
    if (userSearchDebounce.current) clearTimeout(userSearchDebounce.current);

    const raw = query.trim();
    if (!raw || raw.length < 2) {
      setUserResults([]);
      return;
    }

    // Strip leading @ for matching
    const q = raw.startsWith('@') ? raw.slice(1) : raw;
    const qLower = q.toLowerCase();

    // Immediate: search profiles we already have from loaded flyers
    const seen = new Set<string>();
    const localMatches: Profile[] = [];
    for (const f of allFlyers) {
      if (!f.profile || seen.has(f.profile.id)) continue;
      seen.add(f.profile.id);
      const p = f.profile;
      const handleMatch = p.handle?.toLowerCase().includes(qLower);
      const nameMatch = p.display_name?.toLowerCase().includes(qLower);
      if (handleMatch || nameMatch) {
        localMatches.push({
          id: p.id,
          handle: p.handle,
          display_name: p.display_name ?? null,
          bio: null,
          location: null,
          avatar_url: p.avatar_url ?? null,
          avatar_color: (p as any).avatar_color ?? '#EB736C',
          avatar_initials: (p as any).avatar_initials ?? '?',
          is_public: true,
          created_at: '',
        });
      }
    }
    if (localMatches.length > 0) setUserResults(localMatches);

    // Also search Supabase for users we don't have locally
    userSearchDebounce.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, handle, display_name, bio, location, avatar_url, avatar_color, avatar_initials, is_public, created_at')
          .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
          .limit(10);
        if (error) {
          console.warn('[UserSearch] Supabase error:', error.message);
        } else if (data && data.length > 0) {
          // Merge: Supabase results take priority, dedupe by id
          const merged = new Map<string, Profile>();
          for (const p of localMatches) merged.set(p.id, p);
          for (const p of data as Profile[]) merged.set(p.id, p);
          setUserResults(Array.from(merged.values()));
        }
        // If Supabase returned nothing but we have local matches, keep them
      } catch (e) {
        console.warn('[UserSearch] exception:', e);
      }
      setSearchingUsers(false);
    }, 300);

    return () => {
      if (userSearchDebounce.current) clearTimeout(userSearchDebounce.current);
    };
  }, [query, allFlyers]);

  const openUserProfile = useCallback(async (profile: Profile) => {
    setViewingUser(profile);
    setLoadingUserPosts(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select(`
          *,
          profile:profiles!posts_user_id_fkey (
            id, handle, display_name, avatar_url, avatar_color, avatar_initials
          )
        `)
        .eq('user_id', profile.id)
        .eq('is_public', true)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);

      const mapped: Post[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        subtitle: row.subtitle,
        description: row.description,
        location: row.location,
        date_text: row.date_text,
        event_url: row.event_url,
        image: null,
        image_url: row.image_url,
        og_image_url: row.og_image_url,
        bgColor: row.bg_color || '#1a1a2e',
        accent_color: row.accent_color || '#E63946',
        text_color: row.text_color || '#ffffff',
        pattern: row.pattern || 'dots',
        category: row.category,
        tags: row.tags || [],
        is_public: row.is_public,
        is_anonymous: row.is_anonymous,
        moderation_status: row.moderation_status,
        report_count: row.report_count,
        created_at: row.created_at,
        link: row.event_url ? 'Get Tickets' : '',
        profile: row.profile,
        is_saved: false,
        is_mine: false,
      }));
      setViewingUserPosts(mapped);
    } catch {
      setViewingUserPosts([]);
    }
    setLoadingUserPosts(false);
  }, []);

  const bgOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(-30)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  // Reset state when overlay opens
  useEffect(() => {
    if (showSearch) {
      setSelectedWhen('Happening Now');
      setHasSearched(false);
      setShowDateInput(false);
      setCustomDate('');
      setCustomLocation('');

      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 200,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 250,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 250,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      bgOpacity.setValue(0);
      panelTranslateY.setValue(-30);
      panelOpacity.setValue(0);
    }
  }, [showSearch, bgOpacity, panelTranslateY, panelOpacity]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 250,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 250,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: -30,
        duration: 250,
        easing: EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSearch(false);
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleWhen = (when: string) => {
    if (when === 'Pick a Date') {
      setSelectedWhen(when);
      setShowDateInput(true);
    } else {
      setSelectedWhen((prev) => (prev === when ? null : when));
      setShowDateInput(false);
    }
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocation((prev) => (prev === loc ? null : loc));
    setCustomLocation('');
  };

  const handleApply = () => {
    const locationValue = selectedLocation || (customLocation.trim() || null);
    const filters: SearchFilters = {
      query,
      types: selectedTypes,
      when: selectedWhen,
      locations: locationValue,
      customDate: showDateInput ? customDate : undefined,
    };

    if (onApplyFilters) {
      onApplyFilters(filters);
    }

    // Close the overlay after applying
    handleClose();
  };

  const currentFilters: SearchFilters = {
    query,
    types: selectedTypes,
    when: selectedWhen,
    locations: selectedLocation || (customLocation.trim() || null),
    customDate: showDateInput ? customDate : undefined,
  };

  const results = hasSearched ? filterFlyers(currentFilters, allFlyers) : [];

  const thumbWidth = (width - 24 * 2 - 12) / 2;
  const thumbHeight = (thumbWidth * 4) / 3;

  if (!showSearch) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          activeOpacity={0.7}
          onPress={handleClose}
        >
          <Text style={styles.closeText}>X</Text>
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search events, people..."
              placeholderTextColor="rgba(2,4,15,0.4)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* People results — live as you type */}
          {query.trim().length >= 2 && userResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PEOPLE</Text>
              {userResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userRow}
                  activeOpacity={0.7}
                  onPress={() => openUserProfile(user)}
                >
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatarFallback, { backgroundColor: user.avatar_color || '#EB736C' }]}>
                      <Text style={styles.userAvatarInitials}>{user.avatar_initials || '?'}</Text>
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.display_name || user.handle}
                    </Text>
                    <Text style={styles.userHandle} numberOfLines={1}>{user.handle}</Text>
                  </View>
                  <Text style={styles.userArrow}>{'\u203A'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Event Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EVENT TYPE</Text>
            <View style={styles.chipsRow}>
              {EVENT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  selected={selectedTypes.includes(type)}
                  onPress={() => toggleType(type)}
                />
              ))}
            </View>
          </View>

          {/* When */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHEN</Text>
            <View style={styles.chipsRow}>
              {WHEN_OPTIONS.map((when) => (
                <Chip
                  key={when}
                  label={when}
                  selected={selectedWhen === when}
                  onPress={() => toggleWhen(when)}
                />
              ))}
            </View>
            {/* Date picker input */}
            {showDateInput && selectedWhen === 'Pick a Date' && (
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateInput}
                  value={customDate}
                  onChangeText={setCustomDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(2,4,15,0.4)"
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
            )}
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOCATION</Text>
            <View style={styles.chipsRow}>
              {LOCATIONS.map((loc) => (
                <Chip
                  key={loc}
                  label={loc}
                  selected={selectedLocation === loc}
                  onPress={() => toggleLocation(loc)}
                />
              ))}
            </View>
            <TextInput
              style={styles.locationInput}
              value={customLocation}
              onChangeText={(text) => {
                setCustomLocation(text);
                if (text.trim()) setSelectedLocation(null);
              }}
              placeholder="Or type any location..."
              placeholderTextColor="rgba(2,4,15,0.35)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
            />
          </View>

          {/* Search / Apply button */}
          <TouchableOpacity
            style={styles.applyButton}
            activeOpacity={0.8}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>SEARCH</Text>
          </TouchableOpacity>

          {/* Search Results */}
          {hasSearched && (
            <View style={styles.resultsSection}>
              {results.length > 0 ? (
                <View style={styles.resultsGrid}>
                  {results.map((post) => {
                    const imageSource = post.image
                      ? post.image
                      : post.image_url
                      ? { uri: post.image_url }
                      : null;

                    return (
                      <View
                        key={post.id}
                        style={[
                          styles.resultCard,
                          { width: thumbWidth, height: thumbHeight },
                        ]}
                      >
                        {imageSource ? (
                          <Image
                            source={imageSource}
                            style={styles.resultImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.resultImage,
                              { backgroundColor: post.bgColor },
                            ]}
                          />
                        )}
                        <View style={styles.resultOverlay}>
                          <Text style={styles.resultTitle} numberOfLines={2}>
                            {post.title}
                          </Text>
                          <Text style={styles.resultDate} numberOfLines={1}>
                            {post.date_text}
                          </Text>
                          {post.profile && !post.is_anonymous && (
                            <Text style={styles.resultPoster} numberOfLines={1}>
                              {post.profile.display_name || post.profile.handle}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* No results state */
                <View style={styles.noResults}>
                  <SearchIcon size={48} color="rgba(2,4,15,0.2)" />
                  <Text style={styles.noResultsTitle}>No events found</Text>
                  <Text style={styles.noResultsSubtitle}>Try adjusting your filters</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Public profile viewer */}
        {viewingUser && (
          <View style={styles.profileViewer}>
            {/* Back button */}
            <TouchableOpacity
              style={[styles.profileBackButton, { top: insets.top + 12 }]}
              activeOpacity={0.7}
              onPress={() => setViewingUser(null)}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#02040F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            <ScrollView
              style={styles.profileScroll}
              contentContainerStyle={[styles.profileScrollContent, { paddingTop: insets.top + 60 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* User info */}
              <View style={styles.profileHeader}>
                {viewingUser.avatar_url ? (
                  <Image source={{ uri: viewingUser.avatar_url }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatarFallback, { backgroundColor: viewingUser.avatar_color || '#EB736C' }]}>
                    <Text style={styles.profileAvatarInitials}>{viewingUser.avatar_initials || '?'}</Text>
                  </View>
                )}
                <Text style={styles.profileName}>{viewingUser.display_name || viewingUser.handle}</Text>
                <Text style={styles.profileHandle}>{viewingUser.handle}</Text>
                {viewingUser.bio ? <Text style={styles.profileBio}>{viewingUser.bio}</Text> : null}
                {viewingUser.location ? (
                  <View style={styles.profileLocationRow}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(2,4,15,0.5)" strokeWidth={2} />
                      <Circle cx={12} cy={9} r={2.5} stroke="rgba(2,4,15,0.5)" strokeWidth={2} />
                    </Svg>
                    <Text style={styles.profileLocation}>{viewingUser.location}</Text>
                  </View>
                ) : null}
                <Text style={styles.profilePostCount}>
                  {viewingUserPosts.length} post{viewingUserPosts.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* User's posts grid */}
              {loadingUserPosts ? (
                <Text style={styles.profileLoading}>Loading posts...</Text>
              ) : viewingUserPosts.length > 0 ? (
                <View style={styles.resultsGrid}>
                  {viewingUserPosts.map((post) => {
                    const imageSource = post.image
                      ? post.image
                      : post.image_url
                      ? { uri: post.image_url }
                      : null;

                    return (
                      <View
                        key={post.id}
                        style={[styles.resultCard, { width: thumbWidth, height: thumbHeight }]}
                      >
                        {imageSource ? (
                          <Image source={imageSource} style={styles.resultImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.resultImage, { backgroundColor: post.bgColor }]} />
                        )}
                        <View style={styles.resultOverlay}>
                          <Text style={styles.resultTitle} numberOfLines={2}>{post.title}</Text>
                          <Text style={styles.resultDate} numberOfLines={1}>{post.date_text}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsTitle}>No public posts yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(229,218,218,0.95)',
    zIndex: 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: 'rgba(2,4,15,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#02040F',
    fontWeight: '600',
  },
  searchBar: {
    marginTop: 48,
    marginBottom: 32,
  },
  searchInput: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#02040F',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: '#EB736C',
    borderColor: '#EB736C',
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#02040F',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  dateInputContainer: {
    marginTop: 12,
  },
  dateInput: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#02040F',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationInput: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#02040F',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  applyButton: {
    width: '100%',
    backgroundColor: '#E9D25E',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#02040F',
  },
  /* Results */
  resultsSection: {
    marginTop: 32,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resultCard: {
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 30,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  resultTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  resultDate: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  resultPoster: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* No results */
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  noResultsTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: 'rgba(2,4,15,0.45)',
    marginTop: 8,
  },
  noResultsSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.35)',
  },
  /* User search rows */
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.08)',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
    fontWeight: '600',
  },
  userHandle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(2,4,15,0.5)',
    marginTop: 1,
  },
  userArrow: {
    fontFamily: FONTS.body,
    fontSize: 22,
    color: 'rgba(2,4,15,0.3)',
    marginLeft: 8,
  },
  /* Public profile viewer */
  profileViewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(229,218,218,0.98)',
    zIndex: 10,
  },
  profileBackButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2,4,15,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  profileAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '700',
  },
  profileName: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  profileHandle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
    marginTop: 2,
  },
  profileBio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.7)',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  profileLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  profileLocation: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(2,4,15,0.5)',
  },
  profilePostCount: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(2,4,15,0.4)',
    marginTop: 8,
  },
  profileLoading: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
