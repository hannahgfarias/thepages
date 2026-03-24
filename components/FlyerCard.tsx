import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Linking,
  Share,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { ActionRail, MoreIcon } from './ActionRail';
import { ExternalLinkWarning } from './ExternalLinkWarning';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';
import type { Post } from '../types';

interface FlyerCardProps {
  flyer: Post;
  cardHeight: number;
  onSave?: (id: string) => void;
  onActiveChange?: (active: boolean) => void;
  onTagPress?: (tag: string) => void;
}

const TAG_COLORS = [
  { bg: '#78B896', text: '#fff' },
  { bg: '#EB736C', text: '#fff' },
  { bg: '#67C9E3', text: '#fff' },
  { bg: '#E9D25E', text: '#1a1a1a' },
  { bg: '#F0ECEC', text: '#1a1a1a' },
];

/* ─── Small SVG Icons ─── */

function CalendarIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke={COLORS.text85}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PinIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke={COLORS.text85}
        strokeWidth={1.8}
      />
      <Path
        d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke={COLORS.text85}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

/* ─── FlyerCard Component ─── */

export function FlyerCard({ flyer, cardHeight, onSave, onActiveChange, onTagPress }: FlyerCardProps) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState(flyer.is_saved ?? false);
  const [showLinkWarning, setShowLinkWarning] = useState(false);

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const infoTranslateY = useRef(new Animated.Value(30)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;

  const easing = Easing.bezier(0.16, 1, 0.3, 1);

  const toggleActive = useCallback(() => {
    const nextActive = !active;
    setActive(nextActive);
    onActiveChange?.(nextActive);

    if (nextActive) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 350,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(infoTranslateY, {
          toValue: 0,
          duration: 400,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(infoOpacity, {
          toValue: 1,
          duration: 400,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1.02,
          duration: 400,
          easing,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(infoTranslateY, {
          toValue: 30,
          duration: 300,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(infoOpacity, {
          toValue: 0,
          duration: 300,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1,
          duration: 300,
          easing,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [active, overlayOpacity, infoTranslateY, infoOpacity, imageScale, easing]);

  const handleSave = useCallback(() => {
    setSaved((prev) => !prev);
    onSave?.(flyer.id);
  }, [flyer.id, onSave]);

  const handleShare = useCallback(async () => {
    try {
      const pagesUrl = `https://thepages.app/event/${flyer.id}`;
      const message = [
        flyer.title,
        flyer.date_text,
        flyer.location,
        '',
        pagesUrl,
      ].filter((s) => s !== undefined && s !== null).join('\n');

      if (Platform.OS === 'web' && navigator?.share) {
        await navigator.share({
          title: flyer.title,
          text: message,
          url: pagesUrl,
        });
      } else if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
      } else {
        await Share.share({
          message,
          url: pagesUrl,
        });
      }
    } catch {
      // User cancelled or error
    }
  }, [flyer]);

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);

  const handleMore = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Report this flyer', "Don't show me this again", "Don't show from this poster"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setShowReport(true);
          } else if (buttonIndex === 2) {
            Alert.alert('Hidden', "You won't see this event again.");
            // TODO: Add to hidden posts list in AsyncStorage/Supabase
          } else if (buttonIndex === 3) {
            Alert.alert('Poster Hidden', "You won't see events from this poster anymore.");
            // TODO: Add poster to muted list
          }
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report this flyer', onPress: () => setShowReport(true), style: 'destructive' },
        { text: "Don't show me this again", onPress: () => Alert.alert('Hidden', "You won't see this event again.") },
        { text: "Don't show from this poster", onPress: () => Alert.alert('Poster Hidden', "You won't see events from this poster anymore.") },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, []);

  const handleReport = useCallback(async (reason: string) => {
    setReportReason(reason);
    setShowReport(false);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: 'anonymous', // TODO: use real user ID
        post_id: flyer.id,
        reason,
      });
      if (error) throw error;
      Alert.alert('Reported', 'Thanks for helping keep The Pages safe. We\'ll review this shortly.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.', [
        { text: 'Retry', onPress: () => handleReport(reason) },
        { text: 'Dismiss', style: 'cancel' },
      ]);
    }
  }, [flyer.id]);

  const handleCTA = useCallback(() => {
    if (flyer.event_url) {
      setShowLinkWarning(true);
    }
  }, [flyer.event_url]);

  const handleConfirmLink = useCallback(() => {
    if (flyer.event_url) {
      Linking.openURL(flyer.event_url);
    }
    setShowLinkWarning(false);
  }, [flyer.event_url]);

  // Responsive title size
  const titleFontSize = Math.min(32, width * 0.082);

  // Resolve the image source
  const imageSource = flyer.image
    ? flyer.image
    : flyer.image_url
    ? { uri: flyer.image_url }
    : null;

  return (
    <TouchableWithoutFeedback onPress={toggleActive}>
      <View style={[styles.card, { width, height: cardHeight }]}>
        {/* Layer 1: Blur background */}
        {imageSource && (
          <View style={styles.blurContainer}>
            {Platform.OS === 'web' ? (
              <Image
                source={imageSource}
                style={[
                  styles.blurImage,
                  {
                    // @ts-ignore web-only CSS
                    filter: 'blur(40px) brightness(0.6) saturate(1.2)',
                  } as any,
                ]}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={imageSource}
                style={styles.blurImage}
                blurRadius={40}
                resizeMode="cover"
              />
            )}
          </View>
        )}
        {/* Fallback background color */}
        <View
          style={[
            styles.bgFallback,
            { backgroundColor: flyer.bgColor },
          ]}
        />

        {/* Layer 2: Main flyer image */}
        {imageSource && (
          <Animated.View
            style={[
              styles.mainImageContainer,
              { transform: [{ scale: imageScale }] },
            ]}
          >
            <Image
              source={imageSource}
              style={styles.mainImage}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        {/* Layer 3: Dark overlay (animates on tap) */}
        <Animated.View
          style={[
            styles.darkOverlay,
            { opacity: overlayOpacity },
          ]}
        />

        {/* Layer 4: Info panel (animates on tap) */}
        <Animated.View
          style={[
            styles.infoPanel,
            {
              opacity: infoOpacity,
              transform: [{ translateY: infoTranslateY }],
            },
          ]}
          pointerEvents={active ? 'auto' : 'none'}
        >
          {/* Category badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{flyer.category}</Text>
          </View>

          {/* Title */}
          <Text
            style={[styles.title, { fontSize: titleFontSize, lineHeight: titleFontSize * 0.95 }]}
            numberOfLines={3}
          >
            {flyer.title}
          </Text>

          {/* Subtitle */}
          {flyer.subtitle ? (
            <Text style={styles.subtitle}>{flyer.subtitle}</Text>
          ) : null}

          {/* Date row */}
          {flyer.date_text ? (
            <TouchableOpacity
              style={styles.metaRow}
              activeOpacity={0.7}
              onPress={() => {
                const query = encodeURIComponent(flyer.date_text!);
                const url = Platform.select({
                  ios: `calshow:`,
                  android: `content://com.android.calendar/time/`,
                  default: `https://calendar.google.com/calendar/r/search?q=${query}`,
                });
                if (url) Linking.openURL(url);
              }}
            >
              <CalendarIcon />
              <Text style={[styles.metaText, styles.metaTextTappable]}>{flyer.date_text}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Location row */}
          {flyer.location ? (
            <TouchableOpacity
              style={styles.metaRow}
              activeOpacity={0.7}
              onPress={() => {
                const query = encodeURIComponent(flyer.location!);
                const url = Platform.select({
                  ios: `maps:0,0?q=${query}`,
                  android: `geo:0,0?q=${query}`,
                  default: `https://www.google.com/maps/search/?api=1&query=${query}`,
                });
                if (url) Linking.openURL(url);
              }}
            >
              <PinIcon />
              <Text style={[styles.metaText, styles.metaTextTappable]}>{flyer.location}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Tags */}
          {flyer.tags && flyer.tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {flyer.tags.map((tag, index) => {
                const color = TAG_COLORS[index % TAG_COLORS.length];
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagPill, { backgroundColor: color.bg }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Close details, then activate tag filter
                      if (active) {
                        setActive(false);
                        onActiveChange?.(false);
                      }
                      onTagPress?.(tag);
                    }}
                  >
                    <Text style={[styles.tagText, { color: color.text }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* CTA button */}
          {flyer.link ? (
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={handleCTA}
            >
              <Text style={styles.ctaText}>{flyer.link}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Posted by */}
          {flyer.profile ? (
            <TouchableOpacity
              style={styles.postedByRow}
              activeOpacity={0.7}
              onPress={() => {
                // TODO: navigate to user profile
              }}
            >
              {flyer.profile.avatar_url ? (
                <Image
                  source={{ uri: flyer.profile.avatar_url }}
                  style={styles.postedByAvatar}
                />
              ) : (
                <View style={[styles.postedByAvatarFallback, { backgroundColor: flyer.profile.avatar_color || '#EB736C' }]}>
                  <Text style={styles.postedByInitial}>{flyer.profile.avatar_initials || '?'}</Text>
                </View>
              )}
              <Text style={styles.postedByText}>
                {flyer.profile.display_name || flyer.profile.handle || 'Anonymous'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Actions row inside details */}
          <View style={styles.detailsActions}>
            <TouchableOpacity
              style={[styles.detailsActionButton, saved && styles.detailsActionButtonSaved]}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z"
                  stroke="#fff" strokeWidth={1.5} fill={saved ? '#fff' : 'none'}
                />
              </Svg>
              <Text style={styles.detailsActionText}>{saved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsActionButton}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3v12M12 3l4 4M12 3L8 7M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                  stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.detailsActionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsActionButton}
              onPress={handleMore}
              activeOpacity={0.7}
            >
              <MoreIcon />
              <Text style={styles.detailsActionText}>Report</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Layer 5: Action rail — only when details are closed */}
        {!active && (
          <ActionRail
            visible={true}
            onSave={handleSave}
            onShare={handleShare}
            isSaved={saved}
          />
        )}

        {/* Report modal */}
        {showReport && (
          <View style={styles.reportOverlay}>
            <View style={styles.reportSheet}>
              <Text style={styles.reportTitle}>REPORT THIS FLYER</Text>
              <Text style={styles.reportSubtitle}>Why are you reporting this?</Text>
              {[
                { key: 'harmful', label: 'Harmful or dangerous content' },
                { key: 'misleading', label: 'Misleading information' },
                { key: 'inappropriate', label: 'Inappropriate content' },
                { key: 'spam', label: 'Spam or fake event' },
                { key: 'pii', label: 'Contains personal information' },
                { key: 'other', label: 'Other' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.reportOption}
                  activeOpacity={0.7}
                  onPress={() => handleReport(option.key)}
                >
                  <Text style={styles.reportOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.reportCancel}
                activeOpacity={0.7}
                onPress={() => setShowReport(false)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* External link warning modal */}
        <ExternalLinkWarning
          visible={showLinkWarning}
          url={flyer.event_url ?? ''}
          eventTitle={flyer.title}
          onClose={() => setShowLinkWarning(false)}
          onConfirm={handleConfirmLink}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: COLORS.dark,
  },

  /* Blur background */
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  blurImage: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    width: undefined,
    height: undefined,
    opacity: 0.8,
  },
  bgFallback: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },

  /* Main image */
  mainImageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },

  /* Dark overlay */
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.cardOverlay,
    zIndex: 2,
  },

  /* Info panel */
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 28,
    zIndex: 10,
    gap: 10,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0.5,
    borderColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 4,
  },
  categoryText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  title: {
    fontFamily: FONTS.display,
    textTransform: 'uppercase',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.text70,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.text85,
  },
  metaTextTappable: {
    textDecorationLine: 'underline' as const,
    textDecorationColor: 'rgba(255,255,255,0.2)',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagPill: {
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  ctaButton: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#78B896',
    borderRadius: 0,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#78B896',
  },
  postedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  postedByAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  postedByAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postedByInitial: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: '#ffffff',
  },
  postedByText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  detailsActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  detailsActionButtonSaved: {
    backgroundColor: '#EB736C',
  },
  detailsActionText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  reportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  reportSheet: {
    backgroundColor: '#F0ECEC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  reportTitle: {
    fontFamily: 'BarlowCondensed_900Black',
    fontSize: 16,
    letterSpacing: 2,
    color: '#02040F',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 13,
    color: 'rgba(2,4,15,0.5)',
    marginBottom: 20,
  },
  reportOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
  },
  reportOptionText: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 15,
    color: '#02040F',
  },
  reportCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  reportCancelText: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
  },
});
