import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { scanFlyer, moderateContent } from '../lib/scan';
import { pickImageFromLibrary, pickImageFromCamera, readFileAsBase64 } from '../lib/platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const CATEGORIES = [
  'Party', 'Music', 'Community', 'Arts', 'Wellness', 'Food', 'Free', 'Theatre',
  'Fitness', 'Nightlife', 'Volunteer', 'Sports', 'Tech', 'Film', 'Comedy',
  'Markets', 'Workshop', 'Other',
];

function hasBasicPII(text: string): { found: boolean; type: string } {
  // Phone numbers
  if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) return { found: true, type: 'phone number' };
  // Email addresses
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return { found: true, type: 'email address' };
  // SSN
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return { found: true, type: 'social security number' };
  return { found: false, type: '' };
}

export function AddEventSheet() {
  const { showAddEvent, setShowAddEvent, editingPost, setEditingPost } = useOverlay();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ tag: string; count: number }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const tagSuggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const [endHour, setEndHour] = useState<number | null>(null);
  const [endMinute, setEndMinute] = useState<number>(0);
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');
  const [showEndTime, setShowEndTime] = useState(false);
  const [showLinkField, setShowLinkField] = useState(false);
  const [fetchingOG, setFetchingOG] = useState(false);
  const ogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [occurrences, setOccurrences] = useState<Array<{ title: string; subtitle: string; date: string; location: string }>>([]);
  const [locationResults, setLocationResults] = useState<Array<{ display_name: string; name: string; address: any }>>([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which occurrence's date/location is being edited (-1 = none)
  const [editingOccDate, setEditingOccDate] = useState(-1);
  const [editingOccLocation, setEditingOccLocation] = useState(-1);

  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned) && tags.length < 10) {
      setTags([...tags, cleaned]);
      setTagInput('');
      setTagSuggestions([]);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Fetch existing tags matching input from Supabase
  const fetchTagSuggestions = useCallback(async (query: string) => {
    const cleaned = query.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned || cleaned.length < 1) {
      setTagSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      // Fetch all approved public posts' tags to aggregate counts
      const { data, error } = await supabase
        .from('posts')
        .select('tags')
        .eq('is_public', true)
        .eq('moderation_status', 'approved');

      if (error || !data) {
        setTagSuggestions([]);
        setLoadingSuggestions(false);
        return;
      }

      // Count occurrences of each tag
      const tagCounts: Record<string, number> = {};
      for (const row of data) {
        if (row.tags && Array.isArray(row.tags)) {
          for (const t of row.tags) {
            const normalized = t.replace(/^#/, '').toLowerCase();
            tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
          }
        }
      }

      // Filter tags matching the query, exclude already-added tags
      const matches = Object.entries(tagCounts)
        .filter(([tag]) => tag.includes(cleaned) && !tags.map(t => t.toLowerCase()).includes(tag))
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 8)
        .map(([tag, count]) => ({ tag, count }));

      setTagSuggestions(matches);
    } catch {
      setTagSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [tags]);

  // Debounced tag input handler
  const handleTagInputChange = useCallback((text: string) => {
    setTagInput(text);
    if (tagSuggestDebounce.current) clearTimeout(tagSuggestDebounce.current);
    tagSuggestDebounce.current = setTimeout(() => fetchTagSuggestions(text), 300);
  }, [fetchTagSuggestions]);

  // Select a suggested tag
  const selectSuggestedTag = useCallback((tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
    setTagSuggestions([]);
  }, [tags]);

  // Generate calendar days for the date picker
  const [calendarMonth, setCalendarMonth] = useState(new Date());
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

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const formatTimeStr = (hour: number, minute: number, period: 'AM' | 'PM') => {
    const minStr = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
    return `${hour}${minStr}${period}`;
  };

  const buildDateTimeString = () => {
    if (!selectedDate) return '';
    const monthName = MONTHS[selectedDate.getMonth()].toUpperCase().slice(0, 3);
    let result = `${monthName} ${selectedDate.getDate()}`;
    if (selectedHour !== null) {
      result += ` • ${formatTimeStr(selectedHour, selectedMinute, selectedPeriod)}`;
      if (endHour !== null) {
        result += `-${formatTimeStr(endHour, endMinute, endPeriod)}`;
      }
    }
    return result;
  };

  const selectDate = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    setSelectedDate(date);
  };

  // Update dateTime string whenever any time value changes
  useEffect(() => {
    if (selectedDate) {
      setDateTime(buildDateTimeString());
    }
  }, [selectedDate, selectedHour, selectedMinute, selectedPeriod, endHour, endMinute, endPeriod]);

  const selectTime = (hour: number, minute: number, period: 'AM' | 'PM') => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedPeriod(period);
  };

  const selectEndTime = (hour: number, minute: number, period: 'AM' | 'PM') => {
    setEndHour(hour);
    setEndMinute(minute);
    setEndPeriod(period);
  };

  // Location search with debounce — searches businesses, addresses, and places
  const searchLocation = (query: string) => {
    setLocation(query);
    if (locationDebounce.current) clearTimeout(locationDebounce.current);
    if (query.length < 2) {
      setLocationResults([]);
      setShowLocationResults(false);
      return;
    }
    locationDebounce.current = setTimeout(async () => {
      try {
        // Search both Photon (for businesses/POIs) and Nominatim (for addresses)
        const [photonRes, nominatimRes] = await Promise.allSettled([
          fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=4&lang=en&osm_tag=amenity&osm_tag=shop&osm_tag=tourism&osm_tag=leisure`),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4&addressdetails=1&countrycodes=us`, { headers: { 'User-Agent': 'ThePages/1.0' } }),
        ]);

        const combined: any[] = [];
        const seen = new Set<string>();

        // Process Photon results (businesses/POIs)
        if (photonRes.status === 'fulfilled') {
          const photonData = await photonRes.value.json();
          (photonData.features || []).forEach((f: any) => {
            const p = f.properties;
            const name = p.name || '';
            const street = p.housenumber ? `${p.housenumber} ${p.street || ''}` : (p.street || '');
            const city = p.city || p.town || p.village || '';
            const state = p.state || '';
            const addressParts = [street, city, state].filter(Boolean).join(', ');
            const key = `${name}|${addressParts}`.toLowerCase();
            if (!seen.has(key) && (name || street)) {
              seen.add(key);
              combined.push({
                name,
                address: addressParts,
                display: name && addressParts ? `${name}, ${addressParts}` : (name || addressParts),
                type: p.osm_value || '',
              });
            }
          });
        }

        // Process Nominatim results (addresses)
        if (nominatimRes.status === 'fulfilled') {
          const nomData = await nominatimRes.value.json();
          (nomData || []).forEach((r: any) => {
            const a = r.address || {};
            const name = r.name || a.amenity || a.shop || a.tourism || '';
            const houseNum = a.house_number || '';
            const road = a.road || '';
            const street = houseNum ? `${houseNum} ${road}` : road;
            const city = a.city || a.town || a.village || a.hamlet || '';
            const state = a.state || '';
            const addressParts = [street, city, state].filter(Boolean).join(', ');
            const key = `${name}|${addressParts}`.toLowerCase();
            if (!seen.has(key) && (name || street)) {
              seen.add(key);
              combined.push({
                name: name && name !== road ? name : '',
                address: addressParts,
                display: name && name !== road && addressParts ? `${name}, ${addressParts}` : (addressParts || name),
                type: r.type || '',
              });
            }
          });
        }

        setLocationResults(combined.slice(0, 6));
        setShowLocationResults(combined.length > 0);
      } catch {
        setLocationResults([]);
        setShowLocationResults(false);
      }
    }, 350);
  };

  const selectLocation = (result: any) => {
    if (editingOccLocation >= 0) {
      // Selecting for an occurrence
      const updated = [...occurrences];
      updated[editingOccLocation] = { ...updated[editingOccLocation], location: result.display };
      setOccurrences(updated);
      setEditingOccLocation(-1);
    } else {
      setLocation(result.display);
    }
    setShowLocationResults(false);
    setLocationResults([]);
  };

  // Auto-resolve a location query to its best match (used after AI scan prefills)
  const autoResolveLocation = async (query: string): Promise<string> => {
    if (query.length < 2) return query;
    try {
      const [photonRes, nominatimRes] = await Promise.allSettled([
        fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en&osm_tag=amenity&osm_tag=shop&osm_tag=tourism&osm_tag=leisure`),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1&countrycodes=us`, { headers: { 'User-Agent': 'ThePages/1.0' } }),
      ]);
      // Try Photon first (better for venue names)
      if (photonRes.status === 'fulfilled') {
        const data = await photonRes.value.json();
        const f = data.features?.[0];
        if (f) {
          const p = f.properties;
          const name = p.name || '';
          const street = p.housenumber ? `${p.housenumber} ${p.street || ''}` : (p.street || '');
          const city = p.city || p.town || p.village || '';
          const state = p.state || '';
          const addressParts = [street, city, state].filter(Boolean).join(', ');
          if (name || addressParts) {
            return name && addressParts ? `${name}, ${addressParts}` : (name || addressParts);
          }
        }
      }
      // Fall back to Nominatim
      if (nominatimRes.status === 'fulfilled') {
        const nomData = await nominatimRes.value.json();
        const r = nomData?.[0];
        if (r) {
          const a = r.address || {};
          const name = r.name || a.amenity || a.shop || a.tourism || '';
          const houseNum = a.house_number || '';
          const road = a.road || '';
          const street = houseNum ? `${houseNum} ${road}` : road;
          const city = a.city || a.town || a.village || a.hamlet || '';
          const state = a.state || '';
          const addressParts = [street, city, state].filter(Boolean).join(', ');
          if (name && name !== road && addressParts) return `${name}, ${addressParts}`;
          return addressParts || name || query;
        }
      }
    } catch {
      // Silently fall back to original query
    }
    return query;
  };

  // Search location for an occurrence
  const searchOccLocation = (query: string, index: number) => {
    const updated = [...occurrences];
    updated[index] = { ...updated[index], location: query };
    setOccurrences(updated);
    setEditingOccLocation(index);
    // Reuse the same search logic
    if (locationDebounce.current) clearTimeout(locationDebounce.current);
    if (query.length < 2) {
      setLocationResults([]);
      setShowLocationResults(false);
      return;
    }
    locationDebounce.current = setTimeout(async () => {
      try {
        const [photonRes, nominatimRes] = await Promise.allSettled([
          fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=4&lang=en&osm_tag=amenity&osm_tag=shop&osm_tag=tourism&osm_tag=leisure`),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4&addressdetails=1&countrycodes=us`, { headers: { 'User-Agent': 'ThePages/1.0' } }),
        ]);
        const combined: any[] = [];
        const seen = new Set<string>();
        if (photonRes.status === 'fulfilled') {
          const photonData = await photonRes.value.json();
          (photonData.features || []).forEach((f: any) => {
            const p = f.properties;
            const name = p.name || '';
            const street = p.housenumber ? `${p.housenumber} ${p.street || ''}` : (p.street || '');
            const city = p.city || p.town || p.village || '';
            const state = p.state || '';
            const addressParts = [street, city, state].filter(Boolean).join(', ');
            const key = `${name}|${addressParts}`.toLowerCase();
            if (!seen.has(key) && (name || street)) {
              seen.add(key);
              combined.push({ name, address: addressParts, display: name && addressParts ? `${name}, ${addressParts}` : (name || addressParts) });
            }
          });
        }
        if (nominatimRes.status === 'fulfilled') {
          const nomData = await nominatimRes.value.json();
          (nomData || []).forEach((r: any) => {
            const a = r.address || {};
            const name = r.name || a.amenity || a.shop || a.tourism || '';
            const houseNum = a.house_number || '';
            const road = a.road || '';
            const street = houseNum ? `${houseNum} ${road}` : road;
            const city = a.city || a.town || a.village || a.hamlet || '';
            const state = a.state || '';
            const addressParts = [street, city, state].filter(Boolean).join(', ');
            const key = `${name}|${addressParts}`.toLowerCase();
            if (!seen.has(key) && (name || street)) {
              seen.add(key);
              combined.push({ name: name && name !== road ? name : '', address: addressParts, display: name && name !== road && addressParts ? `${name}, ${addressParts}` : (addressParts || name) });
            }
          });
        }
        setLocationResults(combined.slice(0, 6));
        setShowLocationResults(combined.length > 0);
      } catch {
        setLocationResults([]);
        setShowLocationResults(false);
      }
    }, 350);
  };

  // Select a date for an occurrence from the calendar
  const selectOccDate = (day: number, index: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dateStr = `${DAYS[date.getDay()]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
    const updated = [...occurrences];
    updated[index] = { ...updated[index], date: dateStr };
    setOccurrences(updated);
    setEditingOccDate(-1);
  };



  const [scanError, setScanError] = useState<string | null>(null);

  const handlePickResult = async (uri: string, base64?: string) => {
    setImageUri(uri);
    setScanError(null);

    // Try AI scan in the background — don't block the user
    setScanning(true);
    try {
      const imageBase64 = base64 || await readFileAsBase64(uri);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scan timed out — fill in details manually')), 30000)
      );
      const scanPromise = scanFlyer(imageBase64, 'image/jpeg');

      const data = await Promise.race([scanPromise, timeout]);

      if (data) {
        if (data.title) setTitle(data.title);
        if (data.subtitle) setSubtitle(data.subtitle);
        if (data.description) setDescription(data.description);
        if (data.date) setDateTime(data.date);
        if (data.category) setSelectedCategory(data.category);
        if (data.tags && data.tags.length > 0) {
          setTags(data.tags.map((t: string) => t.replace(/^#/, '')));
        }

        // Auto-resolve location to full address
        if (data.location) {
          setLocation(data.location);
          autoResolveLocation(data.location).then((resolved) => {
            setLocation(resolved);
          });
        }

        // If multiple dates/locations detected, store them for multi-post creation
        if (data.occurrences && data.occurrences.length > 1) {
          const occs = data.occurrences.map((occ: any) => ({
            title: occ.title || data.title || '',
            subtitle: occ.subtitle || '',
            date: occ.date || '',
            location: occ.location || '',
          }));
          setOccurrences(occs);
          // Auto-resolve each occurrence's location
          occs.forEach((occ: any, idx: number) => {
            if (occ.location) {
              autoResolveLocation(occ.location).then((resolved) => {
                setOccurrences((prev) => {
                  const updated = [...prev];
                  if (updated[idx]) updated[idx] = { ...updated[idx], location: resolved };
                  return updated;
                });
              });
            }
          });
        } else {
          setOccurrences([]);
        }
      }
    } catch (e: any) {
      console.log('[SCAN] Exception:', e);
      setScanError(e?.message || 'AI scan failed — fill in details manually');
    }

    setScanning(false);
  };

  const pickFromPhotos = async () => {
    try {
      const picked = await pickImageFromLibrary({ aspect: [4, 5], quality: 0.8 });
      if (picked) {
        // Pass base64 directly to avoid re-reading the file
        handlePickResult(picked.uri, picked.base64);
      }
    } catch {
      setScanError('Could not open photo picker.');
    }
  };

  const pickFromCamera = async () => {
    try {
      const picked = await pickImageFromCamera();
      if (picked) {
        handlePickResult(picked.uri, picked.base64);
      }
    } catch {
      setScanError('Could not open camera.');
    }
  };

  const pickFromFiles = async () => {
    // On web, pickFromPhotos already opens a file picker
    // On native, use document picker
    if (Platform.OS === 'web') {
      pickFromPhotos();
      return;
    }
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        handlePickResult(result.assets[0].uri);
      }
    } catch {
      // User cancelled
    }
  };

  const pickImage = () => {
    if (Platform.OS === 'web') {
      // On web, just open the file picker directly
      pickFromPhotos();
    } else if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Photos', 'Browse Files'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          else if (buttonIndex === 2) pickFromPhotos();
          else if (buttonIndex === 3) pickFromFiles();
        }
      );
    } else {
      // Android — show alert-based picker
      Alert.alert('Upload Flyer', 'Choose a source', [
        { text: 'Take Photo', onPress: pickFromCamera },
        { text: 'Photos', onPress: pickFromPhotos },
        { text: 'Files', onPress: pickFromFiles },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Pre-fill form when editing an existing post
  useEffect(() => {
    if (editingPost && showAddEvent) {
      setTitle(editingPost.title || '');
      setSubtitle(editingPost.subtitle || '');
      setDescription(editingPost.description || '');
      setDateTime(editingPost.date_text || '');
      setLocation(editingPost.location || '');
      setLink(editingPost.event_url || '');
      setSelectedCategory(editingPost.category || null);
      setIsPublic(editingPost.is_public !== false);
      setIsAnonymous(editingPost.is_anonymous === true);
      if (editingPost.image_url) {
        setImageUri(editingPost.image_url);
      }
      if (editingPost.tags && editingPost.tags.length > 0) {
        setTags(editingPost.tags.map((t: string) => t.replace(/^#/, '')));
      }
      if (editingPost.event_url) {
        setShowLinkField(true);
      }
    }
  }, [editingPost, showAddEvent]);

  // Auto-fetch OG metadata when a URL is pasted
  const handleLinkChange = (url: string) => {
    setLink(url);
    if (ogDebounce.current) clearTimeout(ogDebounce.current);

    // Only fetch if it looks like a URL
    if (url.match(/^https?:\/\/.+\..+/)) {
      ogDebounce.current = setTimeout(async () => {
        setFetchingOG(true);
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
          const res = await fetch(`${supabaseUrl}/functions/v1/og-fetch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ url }),
          });
          if (res.ok) {
            const og = await res.json();
            // Only auto-fill empty fields — don't overwrite what user already typed
            if (og.title && !title) setTitle(og.title);
            if (og.description && !description) setDescription(og.description);
          }
        } catch {
          // Silent failure — OG fetch is a nice-to-have
        }
        setFetchingOG(false);
      }, 800);
    }
  };

  const resetForm = () => {
    setImageUri(null);
    setScanning(false);
    setScanError(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setDateTime('');
    setLocation('');
    setLink('');
    setSelectedCategory(null);
    setTags([]);
    setTagInput('');
    setShowDatePicker(false);
    setSelectedDate(null);
    setSelectedHour(null);
    setSelectedMinute(0);
    setSelectedPeriod('PM');
    setEndHour(null);
    setEndMinute(0);
    setEndPeriod('PM');
    setShowEndTime(false);
    setShowLinkField(false);
    setOccurrences([]);
    setIsPublic(true);
    setLocationResults([]);
    setShowLocationResults(false);
    setShowLinkField(false);
    setOccurrences([]);
    setIsPublic(true);
    setIsAnonymous(false);
    setPublishing(false);
    setScanError(null);
    setLocationResults([]);
    setShowLocationResults(false);
  };

  const handleClose = () => {
    resetForm();
    setEditingPost(null);
    setShowAddEvent(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please add a title for your event.');
      } else {
        Alert.alert('Missing Title', 'Please add a title for your event.');
      }
      return;
    }

    // 1. PII detection (client-side regex check)
    const allText = [title, subtitle, description, dateTime, location, link].filter(Boolean).join(' ');
    const piiResult = hasBasicPII(allText);
    if (piiResult.found) {
      if (Platform.OS === 'web') {
        window.alert(`Your post may contain a ${piiResult.type}. Please remove it before posting.`);
      } else {
        Alert.alert('Personal Information Detected', `Your post may contain a ${piiResult.type}. Please remove it before posting.`);
      }
      return;
    }

    setPublishing(true);

    try {
      // 2. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (Platform.OS === 'web') window.alert('Please sign in to post.');
        else Alert.alert('Sign In Required', 'Please sign in to post.');
        setPublishing(false);
        return;
      }

      // 3. Upload flyer image if present
      let uploadedImageUrl: string | null = null;
      if (imageUri) {
        try {
          const base64 = await readFileAsBase64(imageUri);
          const filePath = `${user.id}/${Date.now()}.jpg`;
          const { decode: decodeBase64 } = require('base64-arraybuffer');
          const { error: uploadError } = await supabase.storage
            .from('flyers')
            .upload(filePath, decodeBase64(base64), {
              contentType: 'image/jpeg',
              upsert: true,
            });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('flyers').getPublicUrl(filePath);
            uploadedImageUrl = urlData.publicUrl;
          }
        } catch (e) {
          console.log('[UPLOAD] Image upload failed:', e);
          // Continue without image — not a blocker
        }
      }

      // 4. Run AI moderation before publishing
      // Default to approved — moderation will reject/hold if it runs successfully
      let moderationStatus = 'approved';
      try {
        const allText = [title, subtitle, description, dateTime, location].filter(Boolean).join(' ');
        let imageBase64ForMod: string | null = null;
        if (imageUri) {
          try {
            imageBase64ForMod = await readFileAsBase64(imageUri);
          } catch {
            // Continue without image moderation
          }
        }
        const modResult = await moderateContent(imageBase64ForMod, imageBase64ForMod ? 'image/jpeg' : null, allText);
        if (modResult.status === 'rejected') {
          const msg = 'This content does not meet our community standards and cannot be posted.';
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Content Not Allowed', msg);
          setPublishing(false);
          return;
        }
        if (modResult.status === 'held') {
          moderationStatus = 'held';
        }
      } catch (e) {
        console.log('[MODERATION] Error, auto-approving:', e);
        // If moderation service is unavailable, allow the post through
      }

      // 5. Build post data
      // Pick a random color preset for new posts
      const COLOR_PRESETS = [
        { bg: '#1a1a2e', accent: '#E63946', text: '#ffffff' },
        { bg: '#d8f3dc', accent: '#2d6a4f', text: '#1a1a1a' },
        { bg: '#ff6b6b', accent: '#ffd93d', text: '#ffffff' },
        { bg: '#003566', accent: '#ffd166', text: '#ffffff' },
        { bg: '#10002b', accent: '#c77dff', text: '#ffffff' },
        { bg: '#fff8f0', accent: '#ff6b35', text: '#1a1a1a' },
        { bg: '#0d1b2a', accent: '#00b4d8', text: '#ffffff' },
        { bg: '#1a0a00', accent: '#fb8500', text: '#ffffff' },
      ];
      const PATTERNS = ['stripes', 'dots', 'grid', 'zigzag', 'circles'];
      const preset = editingPost
        ? { bg: editingPost.bgColor || editingPost.bg_color, accent: editingPost.accent_color, text: editingPost.text_color }
        : COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
      const pattern = editingPost?.pattern || PATTERNS[Math.floor(Math.random() * PATTERNS.length)];

      const postBase = {
        user_id: user.id,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        event_url: link ? (!/^https?:\/\//i.test(link.trim()) ? 'https://' + link.trim() : link.trim()) : null,
        image_url: uploadedImageUrl || (editingPost?.image_url ?? null),
        bg_color: preset.bg,
        accent_color: preset.accent,
        text_color: preset.text,
        pattern,
        category: selectedCategory || 'Community',
        tags: tags.map(t => `#${t}`),
        is_public: isPublic,
        is_anonymous: isAnonymous,
        moderation_status: moderationStatus,
      };

      if (editingPost) {
        // UPDATE existing post
        const updateData = {
          ...postBase,
          date_text: dateTime || null,
          location: location || null,
        };
        // Don't overwrite user_id on update
        delete (updateData as any).user_id;

        const { error: updateError } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', editingPost.id);

        if (updateError) {
          console.log('[POST] Update error:', JSON.stringify(updateError));
          const errMsg = updateError.message || 'Failed to update. Please try again.';
          if (Platform.OS === 'web') window.alert(`Update failed: ${errMsg}`);
          else Alert.alert('Error', errMsg);
          setPublishing(false);
          return;
        }

        setPublishing(false);
        handleClose();
      } else {
        // INSERT new post(s)
        // If multiple occurrences detected, create one post per occurrence with its own title/subtitle/date/location
        const postsToInsert = occurrences.length > 1
          ? occurrences.map((occ) => ({
              ...postBase,
              title: (occ.title || '').trim() || postBase.title,
              subtitle: (occ.subtitle || '').trim() || postBase.subtitle,
              date_text: (occ.date != null && occ.date !== '') ? occ.date : dateTime || null,
              location: (occ.location != null && occ.location !== '') ? occ.location : location || null,
            }))
          : [{
              ...postBase,
              date_text: dateTime || null,
              location: location || null,
            }];

        const { data: insertedPosts, error: insertError } = await supabase.from('posts').insert(postsToInsert).select('id');

        if (insertError) {
          console.log('[POST] Insert error:', JSON.stringify(insertError));
          const errMsg = insertError.message || 'Failed to post. Please try again.';
          if (Platform.OS === 'web') window.alert(`Post failed: ${errMsg}`);
          else Alert.alert('Error', errMsg);
          setPublishing(false);
          return;
        }

        // Write moderation audit log
        if (insertedPosts && insertedPosts.length > 0) {
          try {
            const logEntries = insertedPosts.map((p: any) => ({
              post_id: p.id,
              action: moderationStatus,
              actor: 'ai',
              reason_category: 'none',
              ai_confidence: 0,
              notes: `Auto-moderated on publish. Status: ${moderationStatus}`,
            }));
            await supabase.from('moderation_log').insert(logEntries);
          } catch {
            // Non-blocking — log failure shouldn't prevent post success
          }
        }

        const postCount = postsToInsert.length;
        setPublishing(false);
        if (postCount > 1) {
          const msg = `Created ${postCount} posts for each date/location.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Posted!', msg);
        }
        handleClose();
      }
    } catch (e) {
      console.log('[POST] Exception:', e);
      if (Platform.OS === 'web') window.alert('Something went wrong. Please try again.');
      else Alert.alert('Error', 'Something went wrong. Please try again.');
      setPublishing(false);
    }
  };

  if (!showAddEvent) return null;

  return (
    <Modal
      visible={showAddEvent}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
          >
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.7}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.sheetTitle}>{editingPost ? 'EDIT EVENT' : occurrences.length > 1 ? `${occurrences.length} EVENTS DETECTED` : 'SHARE SOMETHING HAPPENING'}</Text>

            {/* Upload zone */}
            <TouchableOpacity
              style={[
                styles.uploadZone,
                imageUri && styles.uploadZoneWithImage,
                scanning && styles.uploadZoneScanning,
                imageUri && !scanning && title ? styles.uploadZoneCompact : null,
              ]}
              activeOpacity={0.8}
              onPress={pickImage}
            >
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                  {scanning && (
                    <View style={styles.scanOverlay}>
                      <View style={styles.scanSpinner} />
                      <Text style={styles.scanText}>Scanning flyer...</Text>
                    </View>
                  )}
                  {!scanning && (
                    <TouchableOpacity style={styles.changeImageBtn} onPress={pickImage}>
                      <Text style={styles.changeImageText}>Tap to change</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 5v14M5 12h14"
                      stroke="#999"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Text style={styles.uploadText}>Upload your flyer</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Scan error (dismissible) */}
            {scanError && (
              <TouchableOpacity
                style={{ marginBottom: 12 }}
                activeOpacity={0.7}
                onPress={() => setScanError(null)}
              >
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#EB736C', textAlign: 'center' }}>
                  {scanError} ✕
                </Text>
              </TouchableOpacity>
            )}

            {/* Form fields — hidden when multi-event detected (each occurrence has its own) */}
            {occurrences.length <= 1 && (
              <>
                <View style={styles.field}>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Event title"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.field}>
                  <TextInput
                    style={styles.input}
                    value={subtitle}
                    onChangeText={setSubtitle}
                    placeholder="Tagline or subtitle (optional)"
                    placeholderTextColor="#999"
                  />
                </View>
              </>
            )}

            <View style={styles.field}>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Description (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Date, location — hidden when multi-event (each occurrence has its own) */}
            {occurrences.length <= 1 && (
              <>
            {/* Date & time — tappable to open calendar */}
            <TouchableOpacity
              style={styles.field}
              activeOpacity={0.7}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <View style={styles.input}>
                <Text style={[styles.inputText, !dateTime && { color: '#999' }]}>
                  {dateTime || 'Date & time'}
                </Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#999" strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
              </View>
            </TouchableOpacity>

            {/* Calendar picker */}
            {showDatePicker && (
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
                        onPress={() => day && selectDate(day)}
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

                {/* Time picker */}
                <View style={styles.timePickerContainer}>
                  <Text style={styles.timePickerLabel}>TIME</Text>
                  <View style={styles.timePickerRow}>
                    {/* Hour */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.timeScrollContent}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={[
                            styles.timeChip,
                            selectedHour === h && styles.timeChipSelected,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => selectTime(h, selectedMinute, selectedPeriod)}
                        >
                          <Text style={[
                            styles.timeChipText,
                            selectedHour === h && styles.timeChipTextSelected,
                          ]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Minutes */}
                  <View style={styles.timePickerRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.timeScrollContent}
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.timeChip,
                            selectedHour !== null && selectedMinute === m && styles.timeChipSelected,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (selectedHour !== null) {
                              selectTime(selectedHour, m, selectedPeriod);
                            }
                          }}
                        >
                          <Text style={[
                            styles.timeChipText,
                            selectedHour !== null && selectedMinute === m && styles.timeChipTextSelected,
                          ]}>:{m.toString().padStart(2, '0')}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* AM/PM */}
                  <View style={styles.periodRow}>
                    {(['AM', 'PM'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.periodChip,
                          selectedPeriod === p && styles.periodChipSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setSelectedPeriod(p)}
                      >
                        <Text style={[
                          styles.periodChipText,
                          selectedPeriod === p && styles.periodChipTextSelected,
                        ]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* End time toggle */}
                  {selectedHour !== null && !showEndTime && (
                    <TouchableOpacity
                      style={styles.addEndTime}
                      onPress={() => setShowEndTime(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addEndTimeText}>+ Add end time</Text>
                    </TouchableOpacity>
                  )}

                  {/* End time picker */}
                  {showEndTime && (
                    <View style={styles.endTimeSection}>
                      <View style={styles.endTimeHeader}>
                        <Text style={styles.timePickerLabel}>END TIME</Text>
                        <TouchableOpacity onPress={() => { setShowEndTime(false); setEndHour(null); }} activeOpacity={0.7}>
                          <Text style={styles.removeEndTime}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timePickerRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeScrollContent}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                            <TouchableOpacity
                              key={h}
                              style={[styles.timeChip, endHour === h && styles.timeChipSelected]}
                              activeOpacity={0.7}
                              onPress={() => selectEndTime(h, endMinute, endPeriod)}
                            >
                              <Text style={[styles.timeChipText, endHour === h && styles.timeChipTextSelected]}>{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={styles.timePickerRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeScrollContent}>
                          {[0, 15, 30, 45].map((m) => (
                            <TouchableOpacity
                              key={m}
                              style={[styles.timeChip, endHour !== null && endMinute === m && styles.timeChipSelected]}
                              activeOpacity={0.7}
                              onPress={() => { if (endHour !== null) selectEndTime(endHour, m, endPeriod); }}
                            >
                              <Text style={[styles.timeChipText, endHour !== null && endMinute === m && styles.timeChipTextSelected]}>:{m.toString().padStart(2, '0')}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      <View style={styles.periodRow}>
                        {(['AM', 'PM'] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[styles.periodChip, endPeriod === p && styles.periodChipSelected]}
                            activeOpacity={0.7}
                            onPress={() => setEndPeriod(p)}
                          >
                            <Text style={[styles.periodChipText, endPeriod === p && styles.periodChipTextSelected]}>{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Done button to close picker */}
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  activeOpacity={0.8}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.pickerDoneText}>DONE</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.field, styles.locationField, showLocationResults && editingOccLocation < 0 && { zIndex: 9999, elevation: 9999 }]}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={searchLocation}
                placeholder="Search venue or address"
                placeholderTextColor="#999"
                onFocus={() => {
                  setEditingOccLocation(-1);
                  if (locationResults.length > 0) setShowLocationResults(true);
                }}
                onBlur={() => {
                  // Delay hiding so tap on result registers
                  setTimeout(() => setShowLocationResults(false), 200);
                }}
              />
              {showLocationResults && (
                <View style={styles.locationDropdown}>
                  {locationResults.map((result: any, i: number) => {
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.locationResult}
                        activeOpacity={0.7}
                        onPress={() => selectLocation(result)}
                      >
                        {result.name ? (
                          <>
                            <Text style={styles.locationResultName} numberOfLines={1}>{result.name}</Text>
                            <Text style={styles.locationResultSub} numberOfLines={2}>{result.address}</Text>
                          </>
                        ) : (
                          <Text style={styles.locationResultName} numberOfLines={2}>{result.address}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
              </>
            )}

            {/* Multiple dates/locations detected — editable sections */}
            {occurrences.length > 1 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 12, letterSpacing: 1.5, color: '#78B896', marginBottom: 12 }}>
                  {occurrences.length} EVENTS DETECTED — EDIT EACH BELOW
                </Text>
                {occurrences.map((occ, i) => (
                  <View key={i} style={[styles.occurrenceCard, editingOccLocation === i && { zIndex: 9999, elevation: 9999 }]}>
                    <View style={styles.occurrenceHeader}>
                      <Text style={styles.occurrenceLabel}>
                        EVENT {i + 1} OF {occurrences.length}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setOccurrences(occurrences.filter((_, idx) => idx !== i));
                          if (editingOccDate === i) setEditingOccDate(-1);
                          if (editingOccLocation === i) setEditingOccLocation(-1);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Text style={styles.occurrenceRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.input, styles.occurrenceInput]}
                      value={occ.title}
                      onChangeText={(text) => {
                        const updated = [...occurrences];
                        updated[i] = { ...updated[i], title: text };
                        setOccurrences(updated);
                      }}
                      placeholder="Title"
                      placeholderTextColor="#999"
                      multiline
                    />
                    <TextInput
                      style={[styles.input, styles.occurrenceInput]}
                      value={occ.subtitle}
                      onChangeText={(text) => {
                        const updated = [...occurrences];
                        updated[i] = { ...updated[i], subtitle: text };
                        setOccurrences(updated);
                      }}
                      placeholder="Subtitle / performer"
                      placeholderTextColor="#999"
                      multiline
                    />

                    {/* Date — tappable to open calendar */}
                    <TouchableOpacity
                      style={styles.occurrenceInput}
                      activeOpacity={0.7}
                      onPress={() => setEditingOccDate(editingOccDate === i ? -1 : i)}
                    >
                      <View style={styles.input}>
                        <Text style={[styles.inputText, !occ.date && { color: '#999' }]}>
                          {occ.date || 'Date & time'}
                        </Text>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#999" strokeWidth={1.5} strokeLinecap="round" />
                        </Svg>
                      </View>
                    </TouchableOpacity>

                    {/* Inline calendar for this occurrence */}
                    {editingOccDate === i && (
                      <View style={[styles.calendarContainer, { marginBottom: 8 }]}>
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
                        <View style={styles.calendarWeekdays}>
                          {WEEKDAYS.map((d) => (
                            <Text key={d} style={styles.calendarWeekday}>{d}</Text>
                          ))}
                        </View>
                        <View style={styles.calendarGrid}>
                          {getDaysInMonth(calendarMonth).map((day, di) => {
                            const isToday = day === new Date().getDate() &&
                              calendarMonth.getMonth() === new Date().getMonth() &&
                              calendarMonth.getFullYear() === new Date().getFullYear();
                            return (
                              <TouchableOpacity
                                key={di}
                                style={[
                                  styles.calendarDay,
                                  isToday && styles.calendarDayToday,
                                ]}
                                activeOpacity={day ? 0.7 : 1}
                                onPress={() => day && selectOccDate(day, i)}
                              >
                                <Text style={styles.calendarDayText}>
                                  {day || ''}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity
                          style={styles.pickerDoneButton}
                          activeOpacity={0.8}
                          onPress={() => setEditingOccDate(-1)}
                        >
                          <Text style={styles.pickerDoneText}>DONE</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Location — searchable with dropdown */}
                    <View style={[styles.locationField, editingOccLocation === i && { zIndex: 9999, elevation: 9999 }]}>
                      <TextInput
                        style={[styles.input, { marginBottom: 0 }]}
                        value={occ.location}
                        onChangeText={(text) => searchOccLocation(text, i)}
                        placeholder="Search venue or address"
                        placeholderTextColor="#999"
                        onFocus={() => {
                          setEditingOccLocation(i);
                          if (locationResults.length > 0) setShowLocationResults(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            if (editingOccLocation === i) setShowLocationResults(false);
                          }, 200);
                        }}
                      />
                      {showLocationResults && editingOccLocation === i && locationResults.length > 0 && (
                        <View style={styles.locationDropdown}>
                          {locationResults.map((result: any, ri: number) => (
                            <TouchableOpacity
                              key={ri}
                              style={styles.locationResult}
                              activeOpacity={0.7}
                              onPress={() => selectLocation(result)}
                            >
                              {result.name ? (
                                <>
                                  <Text style={styles.locationResultName} numberOfLines={1}>{result.name}</Text>
                                  <Text style={styles.locationResultSub} numberOfLines={2}>{result.address}</Text>
                                </>
                              ) : (
                                <Text style={styles.locationResultName} numberOfLines={2}>{result.address}</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {showLinkField ? (
              <View style={styles.field}>
                <View style={styles.linkFieldHeader}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={link}
                    onChangeText={handleLinkChange}
                    placeholder="Ticket or event link"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    keyboardType="url"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.removeLinkButton}
                    onPress={() => { setShowLinkField(false); setLink(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeLinkText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addLinkButton}
                onPress={() => setShowLinkField(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addLinkText}>+ Add link</Text>
              </TouchableOpacity>
            )}

            {/* Category chips */}
            <View style={styles.categorySection}>
              <Text style={styles.categoryLabel}>Category</Text>
              <View style={styles.categoryChips}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.7}
                    onPress={() =>
                      setSelectedCategory((prev) => (prev === cat ? null : cat))
                    }
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat && styles.categoryChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === cat && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Hashtags */}
            <View style={styles.categorySection}>
              <Text style={styles.categoryLabel}>Hashtags</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={tagInput}
                  onChangeText={handleTagInputChange}
                  placeholder="Add a hashtag"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.tagAddBtn} onPress={addTag} activeOpacity={0.7}>
                  <Text style={styles.tagAddBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {/* Tag suggestions dropdown */}
              {tagInput.trim().length > 0 && (tagSuggestions.length > 0 || loadingSuggestions) && (
                <View style={styles.tagSuggestionsContainer}>
                  {loadingSuggestions && tagSuggestions.length === 0 ? (
                    <View style={styles.tagSuggestionLoading}>
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  ) : (
                    tagSuggestions.map(({ tag, count }) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.tagSuggestionRow}
                        activeOpacity={0.7}
                        onPress={() => selectSuggestedTag(tag)}
                      >
                        <Text style={styles.tagSuggestionText}>#{tag}</Text>
                        <Text style={styles.tagSuggestionCount}>
                          {count} {count === 1 ? 'post' : 'posts'}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              {tags.length > 0 && (
                <View style={styles.categoryChips}>
                  {tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.categoryChip, styles.categoryChipSelected]}
                      activeOpacity={0.7}
                      onPress={() => removeTag(tag)}
                    >
                      <Text style={styles.categoryChipTextSelected}>#{tag} ×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {tags.length === 0 && tagSuggestions.length === 0 && (
                <Text style={styles.tagHint}>Tap + or press return to add. Max 10.</Text>
              )}
            </View>

            {/* Visibility toggle */}
            <View style={styles.visibilityRow}>
              <View>
                <Text style={styles.visibilityLabel}>
                  {isPublic ? 'Public Post' : 'Private Post 🔒'}
                </Text>
                <Text style={styles.visibilityHint}>
                  {isPublic ? 'Visible to everyone in the feed' : 'Only visible to you & your community'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: '#78B896', false: '#ddd' }}
                thumbColor="#fff"
              />
            </View>


          </ScrollView>

          {/* Sticky submit button */}
          <TouchableOpacity
            style={[styles.submitButton, { paddingBottom: insets.bottom + 20 }, publishing && styles.submitButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={publishing}
          >
            <Text style={styles.submitText}>
              {publishing ? 'CHECKING CONTENT...' : editingPost ? 'UPDATE EVENT' : 'POST TO THE PAGES'}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.sheetBg,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      } as any,
      default: {},
    }),
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: 'rgba(2,4,15,0.4)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
  },
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 0,
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
    overflow: 'hidden',
  },
  uploadZoneWithImage: {
    borderStyle: 'solid',
    borderColor: '#78B896',
  },
  uploadZoneCompact: {
    aspectRatio: 3 / 2,
  },
  uploadZoneScanning: {
    borderColor: '#78B896',
    backgroundColor: 'rgba(120,184,150,0.08)',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scanSpinner: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: 'rgba(120,184,150,0.2)',
    borderTopColor: '#78B896',
    borderRadius: 14,
  },
  scanText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#78B896',
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  changeImageText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#fff',
  },
  uploadText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#999',
  },
  field: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 1,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#333',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tagAddBtn: {
    width: 48,
    backgroundColor: '#02040F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#fff',
  },
  tagHint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.3)',
    marginTop: 4,
  },
  tagSuggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  tagSuggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  tagSuggestionText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
  },
  tagSuggestionCount: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#999',
  },
  tagSuggestionLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    color: '#999',
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
    backgroundColor: '#02040F',
    borderRadius: 0,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: '#02040F',
    borderRadius: 0,
  },
  calendarDayText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#333',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
  },
  timePickerContainer: {
    marginTop: 12,
    width: '100%',
  },
  timePickerLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 8,
  },
  timePickerRow: {
    marginBottom: 8,
  },
  timeScrollContent: {
    gap: 6,
    paddingRight: 8,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeChipSelected: {
    backgroundColor: '#E9D25E',
    borderColor: '#E9D25E',
  },
  timeChipText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: '#333',
  },
  timeChipTextSelected: {
    color: '#02040F',
    fontFamily: FONTS.display,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  periodChipSelected: {
    backgroundColor: '#E9D25E',
    borderColor: '#E9D25E',
  },
  periodChipText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: '#333',
  },
  periodChipTextSelected: {
    color: '#02040F',
    fontFamily: FONTS.display,
  },
  linkFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeLinkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(2,4,15,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLinkText: {
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
  },
  addLinkButton: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  addLinkText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
  },
  locationField: {
    zIndex: 100,
    elevation: 100,
    position: 'relative',
  },
  locationDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  locationResult: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationResultName: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#02040F',
    marginBottom: 2,
  },
  locationResultSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#999',
  },
  pickerDoneButton: {
    marginTop: 16,
    backgroundColor: '#E9D25E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerDoneText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 2,
    color: '#02040F',
  },
  addEndTime: {
    marginTop: 10,
    paddingVertical: 6,
  },
  addEndTimeText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
  },
  endTimeSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(2,4,15,0.08)',
  },
  endTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeEndTime: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#EB736C',
  },
  categorySection: {
    marginTop: 4,
    marginBottom: 20,
  },
  categoryLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  categoryChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(2,4,15,0.06)',
  },
  visibilityLabel: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
  },
  visibilityHint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#02040F',
    borderRadius: 0,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(2,4,15,0.1)',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  occurrenceCard: {
    backgroundColor: 'rgba(120,184,150,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(120,184,150,0.2)',
  },
  occurrenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  occurrenceLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#78B896',
  },
  occurrenceRemove: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(2,4,15,0.3)',
  },
  occurrenceInput: {
    marginBottom: 8,
  },
  submitText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
});
