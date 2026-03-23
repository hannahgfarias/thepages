import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { useFlyers } from '../hooks/useFlyers';
import type { Post } from '../types';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

const EVENT_TYPES = ['Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre'];
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
    // Query filter
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchesQuery =
        flyer.title.toLowerCase().includes(q) ||
        (flyer.subtitle && flyer.subtitle.toLowerCase().includes(q)) ||
        (flyer.location && flyer.location.toLowerCase().includes(q)) ||
        (flyer.date_text && flyer.date_text.toLowerCase().includes(q)) ||
        flyer.category.toLowerCase().includes(q) ||
        flyer.tags.some((t) => t.toLowerCase().includes(q));
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
      const flyerLoc = (flyer.location || '').toLowerCase();
      if (loc === 'sf' && !flyerLoc.includes('sf') && !flyerLoc.includes('san francisco')) return false;
      if (loc === 'oakland' && !flyerLoc.includes('oakland')) return false;
      if (loc === 'la' && !flyerLoc.includes('los angeles') && !flyerLoc.includes('la')) return false;
      if (loc === 'nyc' && !flyerLoc.includes('new york') && !flyerLoc.includes('ny') && !flyerLoc.includes('ridgewood')) return false;
      // "Near Me" passes all
    }

    return true;
  });
}

interface SearchOverlayProps {
  onApplyFilters?: (filters: SearchFilters) => void;
}

export function SearchOverlay({ onApplyFilters }: SearchOverlayProps) {
  const { showSearch, setShowSearch } = useOverlay();
  const { flyers: allFlyers } = useFlyers();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedWhen, setSelectedWhen] = useState<string | null>('Happening Now');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 300,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 400,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 400,
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
  };

  const handleApply = () => {
    const filters: SearchFilters = {
      query,
      types: selectedTypes,
      when: selectedWhen,
      locations: selectedLocation,
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
    locations: selectedLocation,
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
              placeholder="Search events..."
              placeholderTextColor="rgba(2,4,15,0.4)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

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
});
