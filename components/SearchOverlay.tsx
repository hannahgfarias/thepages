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
import { useFlyers, parseEventDate } from '../hooks/useFlyers';
import type { Post } from '../types';
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
  const { flyers: allFlyers } = useFlyers();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedWhen, setSelectedWhen] = useState<string | null>('Happening Now');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
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
      setSelectedDate(null);
      setCalendarMonth(new Date());

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

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const selectCalendarDate = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    setSelectedDate(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setCustomDate(`${y}-${m}-${d}`);
  };

  const toggleWhen = (when: string) => {
    if (when === 'Pick a Date') {
      setSelectedWhen(when);
      setShowDateInput(true);
    } else {
      setSelectedWhen((prev) => (prev === when ? null : when));
      setShowDateInput(false);
      setSelectedDate(null);
      setCustomDate('');
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
            {/* Calendar date picker */}
            {showDateInput && selectedWhen === 'Pick a Date' && (
              <View style={styles.calendarContainer}>
                {/* Month navigation */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}>
                    <Text style={styles.calendarNav}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthLabel}>
                    {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </Text>
                  <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}>
                    <Text style={styles.calendarNav}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* Weekday headers */}
                <View style={styles.calendarWeekdays}>
                  {WEEKDAYS.map((d) => (
                    <Text key={d} style={styles.calendarWeekday}>{d}</Text>
                  ))}
                </View>

                {/* Days grid */}
                <View style={styles.calendarGrid}>
                  {getDaysInMonth(calendarMonth).map((day, i) => {
                    const isSelected = selectedDate &&
                      day === selectedDate.getDate() &&
                      calendarMonth.getMonth() === selectedDate.getMonth() &&
                      calendarMonth.getFullYear() === selectedDate.getFullYear();
                    const isToday = day === new Date().getDate() &&
                      calendarMonth.getMonth() === new Date().getMonth() &&
                      calendarMonth.getFullYear() === new Date().getFullYear();

                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.calendarDay,
                          isSelected && styles.calendarDaySelected,
                          isToday && !isSelected && styles.calendarDayToday,
                        ]}
                        activeOpacity={day ? 0.7 : 1}
                        onPress={() => day && selectCalendarDate(day)}
                      >
                        <Text style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                        ]}>
                          {day || ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedDate && (
                  <Text style={styles.selectedDateLabel}>
                    {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                  </Text>
                )}
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
  calendarContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 0,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNav: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: '#02040F',
    paddingHorizontal: 12,
  },
  calendarMonthLabel: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1,
    color: '#02040F',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#EB736C',
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: '#02040F',
  },
  calendarDayText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#02040F',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
  },
  selectedDateLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#EB736C',
    textAlign: 'center',
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
