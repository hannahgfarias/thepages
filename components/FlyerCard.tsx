import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  onShare?: (id: string) => void;
  onActiveChange?: (active: boolean) => void;
  onTagPress?: (tag: string) => void;
  onEdit?: (post: Post) => void;
  onDelete?: (id: string) => void;
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

/* ─── Helpers ─── */

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/* ─── FlyerCard Component ─── */

export function FlyerCard({ flyer, cardHeight, onSave, onShare, onActiveChange, onTagPress, onEdit, onDelete }: FlyerCardProps) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState(flyer.is_saved ?? false);
  useEffect(() => {
    setSaved(flyer.is_saved ?? false);
  }, [flyer.is_saved]);
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
      // Always link to the flyer on The Pages
      const flyerUrl = `https://thepages.app/event/${flyer.id}`;

      const details = [
        flyer.title,
        flyer.date_text,
        flyer.location,
      ].filter(Boolean).join('\n');

      let shared = false;
      if (Platform.OS === 'web' && navigator?.share) {
        await navigator.share({
          title: flyer.title,
          text: details,
          url: flyerUrl,
        });
        shared = true;
      } else if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(`${details}\n\n${flyerUrl}`);
        shared = true;
      } else {
        // iOS: pass details as message, flyer link as url for rich preview
        const result = await Share.share({
          message: details,
          url: flyerUrl,
        });
        shared = result.action === Share.sharedAction;
      }

      if (shared) {
        onShare?.(flyer.id);
      }
    } catch {
      // User cancelled or error
    }
  }, [flyer, onShare]);

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [showWebMenu, setShowWebMenu] = useState(false);

  const handleDelete = useCallback(() => {
    const doDelete = async () => {
      try {
        const { error } = await supabase.from('posts').delete().eq('id', flyer.id);
        if (error) throw error;
        onDelete?.(flyer.id);
      } catch {
        if (Platform.OS === 'web') window.alert('Could not delete post. Please try again.');
        else Alert.alert('Error', 'Could not delete post. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this event? This cannot be undone.')) doDelete();
    } else {
      Alert.alert('Delete Event', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [flyer.id, onDelete]);

  const handleMore = useCallback(() => {
    const isMine = flyer.is_mine === true;

    if (Platform.OS === 'ios') {
      const options = isMine
        ? ['Cancel', 'Edit Event', 'Delete Event']
        : ['Cancel', 'Report this flyer', "Don't show me this again", "Don't show from this poster"];
      const destructiveIndex = isMine ? 2 : 1;

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: destructiveIndex },
        (buttonIndex) => {
          if (isMine) {
            if (buttonIndex === 1) onEdit?.(flyer);
            else if (buttonIndex === 2) handleDelete();
          } else {
            if (buttonIndex === 1) setShowReport(true);
            else if (buttonIndex === 2) Alert.alert('Hidden', "You won't see this event again.");
            else if (buttonIndex === 3) Alert.alert('Poster Hidden', "You won't see events from this poster anymore.");
          }
        }
      );
    } else if (Platform.OS === 'web') {
      if (isMine) {
        // Show a simple web menu for own posts
        setShowWebMenu(true);
      } else {
        setShowReport(true);
      }
    } else {
      const buttons = isMine
        ? [
            { text: 'Edit Event', onPress: () => onEdit?.(flyer) },
            { text: 'Delete Event', onPress: handleDelete, style: 'destructive' as const },
            { text: 'Cancel', style: 'cancel' as const },
          ]
        : [
            { text: 'Report this flyer', onPress: () => setShowReport(true), style: 'destructive' as const },
            { text: "Don't show me this again", onPress: () => Alert.alert('Hidden', "You won't see this event again.") },
            { text: "Don't show from this poster", onPress: () => Alert.alert('Poster Hidden', "You won't see events from this poster anymore.") },
            { text: 'Cancel', style: 'cancel' as const },
          ];
      Alert.alert('Options', undefined, buttons);
    }
  }, [flyer, onEdit, handleDelete]);

  const handleReport = useCallback(async (reason: string) => {
    setReportReason(reason);
    setShowReport(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign In Required', 'You need to be signed in to report content.');
        return;
      }
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
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

          {/* Date row — tap to add to calendar */}
          {flyer.date_text ? (
            <TouchableOpacity
              style={styles.metaRow}
              activeOpacity={0.7}
              onPress={() => {
                // Build a Google Calendar "create event" URL
                const title = encodeURIComponent(flyer.title || 'Event');
                const location = encodeURIComponent(flyer.location || '');
                const details = encodeURIComponent(
                  [flyer.subtitle, flyer.event_url ? `Link: ${flyer.event_url}` : '', `Found on The Pages`]
                    .filter(Boolean).join('\n')
                );
                // Use the date_text as-is for the event (Google Calendar will parse it)
                const dateText = encodeURIComponent(flyer.date_text || '');
                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateText}&location=${location}&details=${details}`;
                Linking.openURL(url);
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

          {/* Posted by — hidden for anonymous posts */}
          {flyer.profile && !flyer.is_anonymous ? (
            <TouchableOpacity
              style={styles.postedByRow}
              activeOpacity={0.7}
              onPress={() => {
                // Open poster's profile panel
                // For now, no-op — profile navigation requires a dedicated screen
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
          ) : flyer.is_anonymous ? (
            <View style={styles.postedByRow}>
              <View style={[styles.postedByAvatarFallback, { backgroundColor: '#666' }]}>
                <Text style={styles.postedByInitial}>?</Text>
              </View>
              <Text style={styles.postedByText}>Anonymous</Text>
            </View>
          ) : null}

          {/* Save & share counts — social proof / energy */}
          {(flyer.save_count > 0 || flyer.share_count > 0) ? (
            <View style={styles.countsRow}>
              {flyer.save_count > 0 && (
                <Text style={styles.countsText}>
                  {formatCount(flyer.save_count)} {flyer.save_count === 1 ? 'save' : 'saves'}
                </Text>
              )}
              {flyer.save_count > 0 && flyer.share_count > 0 && (
                <Text style={styles.countsDot}>·</Text>
              )}
              {flyer.share_count > 0 && (
                <Text style={styles.countsText}>
                  shared {formatCount(flyer.share_count)} {flyer.share_count === 1 ? 'time' : 'times'}
                </Text>
              )}
            </View>
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

        {/* Private post badge */}
        {!flyer.is_public && (
          <View style={styles.privateBadge}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
                stroke="#fff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.privateBadgeText}>PRIVATE</Text>
          </View>
        )}

        {/* Web edit/delete menu for own posts */}
        {showWebMenu && (
          <View style={styles.reportOverlay}>
            <View style={styles.reportSheet}>
              <Text style={styles.reportTitle}>YOUR EVENT</Text>
              <TouchableOpacity
                style={styles.reportOption}
                activeOpacity={0.7}
                onPress={() => { setShowWebMenu(false); onEdit?.(flyer); }}
              >
                <Text style={styles.reportOptionText}>Edit Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportOption}
                activeOpacity={0.7}
                onPress={() => { setShowWebMenu(false); handleDelete(); }}
              >
                <Text style={[styles.reportOptionText, { color: '#EB736C' }]}>Delete Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportCancel}
                activeOpacity={0.7}
                onPress={() => setShowWebMenu(false)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  countsText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  countsDot: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
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
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 2,
    color: '#02040F',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontFamily: FONTS.body,
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
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#02040F',
  },
  reportCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  reportCancelText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(2,4,15,0.4)',
  },
  privateBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    zIndex: 5,
  },
  privateBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: '#fff',
  },
});
