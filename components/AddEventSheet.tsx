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
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
  Alert,
  ActionSheetIOS,
  Switch,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { pickImageFromLibrary, pickImageFromCamera, readFileAsBase64 } from '../lib/platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

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
  const { showAddEvent, setShowAddEvent } = useOverlay();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned) && tags.length < 10) {
      setTags([...tags, cleaned]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

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

  const selectDate = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    setSelectedDate(date);
    const monthName = MONTHS[date.getMonth()].toUpperCase().slice(0, 3);
    setDateTime(`${monthName} ${day}`);
    setShowDatePicker(false);
  };

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showAddEvent) {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 400,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 300,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideY.setValue(height);
      scrimOpacity.setValue(0);
    }
  }, [showAddEvent, slideY, scrimOpacity, height]);

  const [scanError, setScanError] = useState<string | null>(null);

  const handlePickResult = async (uri: string, base64?: string) => {
    setImageUri(uri);
    setScanning(true);
    setScanError(null);

    try {
      // Use pre-computed base64 if available (from pickImageFromLibrary), otherwise read from URI
      const imageBase64 = base64 || await readFileAsBase64(uri);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 45000)
      );
      const scanPromise = supabase.functions.invoke('scan-flyer', {
        body: { imageBase64, mediaType: 'image/jpeg' },
      });

      const { data, error } = await Promise.race([scanPromise, timeout]);

      if (data && !error) {
        if (data.title) setTitle(data.title);
        if (data.date) setDateTime(data.date);
        if (data.location) setLocation(data.location);
        if (data.category) setSelectedCategory(data.category);
      } else {
        console.log('[SCAN] Error:', error, data);
        setScanError('AI scan failed — fill in the details manually.');
      }
    } catch (e) {
      console.log('[SCAN] Exception:', e);
      setScanError('AI scan timed out — fill in the details manually.');
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

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 350,
        easing: EASING,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 250,
        easing: EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAddEvent(false);
    });
  };

  const handleSubmit = async () => {
    // 1. PII detection (client-side regex check)
    const allText = [title, dateTime, location, link].filter(Boolean).join(' ');
    const piiResult = hasBasicPII(allText);
    if (piiResult.found) {
      Alert.alert(
        'Personal Information Detected',
        `Your post may contain a ${piiResult.type}. Please remove it before posting.`
      );
      return;
    }

    // 2. AI moderation via edge function
    setPublishing(true);
    try {
      const textToModerate = [title, selectedCategory, location].filter(Boolean).join(' ');
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 20000)
      );
      const moderatePromise = supabase.functions.invoke('moderate-content', {
        body: { text: textToModerate, imageBase64: null },
      });
      const { data, error } = await Promise.race([moderatePromise, timeout]);

      if (error) {
        // Network / invocation error — treat as held (fail closed)
        Alert.alert('Unable to verify', 'Please try again in a moment.');
        setPublishing(false);
        return;
      }

      if (data?.status === 'rejected') {
        Alert.alert('Content Not Allowed', 'This content violates our community guidelines.');
        setPublishing(false);
        return;
      }

      if (data?.status === 'held') {
        Alert.alert('Under Review', 'Your post is under review and will appear shortly.');
        setPublishing(false);
        handleClose();
        return;
      }

      // 3. Approved — proceed with publishing
      setPublishing(false);
      handleClose();
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setPublishing(false);
    }
  };

  if (!showAddEvent) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 90 }]} pointerEvents="box-none">
      {/* Scrim */}
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]} pointerEvents="auto">
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: height * 0.92,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          bounces
        >
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Title */}
            <Text style={styles.sheetTitle}>SHARE SOMETHING HAPPENING</Text>

            {/* Upload zone */}
            <TouchableOpacity
              style={[
                styles.uploadZone,
                imageUri && styles.uploadZoneWithImage,
                scanning && styles.uploadZoneScanning,
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

            {/* Form fields */}
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor="#999"
              />
            </View>

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

                {/* Manual time entry */}
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={dateTime.includes('•') ? dateTime.split('•')[1]?.trim() : ''}
                  onChangeText={(t) => {
                    if (selectedDate) {
                      const monthName = MONTHS[selectedDate.getMonth()].toUpperCase().slice(0, 3);
                      setDateTime(`${monthName} ${selectedDate.getDate()} • ${t}`);
                    } else {
                      setDateTime(t);
                    }
                  }}
                  placeholder="Add time (e.g. 7PM, DOORS 10PM)"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Location"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={link}
                onChangeText={setLink}
                placeholder="Link"
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

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
                  onChangeText={setTagInput}
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
              {tags.length === 0 && (
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
            {publishing ? 'CHECKING CONTENT...' : 'POST TO THE PAGES'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.scrim,
    zIndex: 90,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 91,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
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
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
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
  submitText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
});
