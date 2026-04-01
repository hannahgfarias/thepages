import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
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
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ActionRail, MoreIcon } from './ActionRail';
import { ExternalLinkWarning } from './ExternalLinkWarning';
import { useAuth } from '../hooks/useAuth';
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
  onCategoryPress?: (category: string) => void;
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

/* ─── FlyerCard Component ─── */

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

export const FlyerCard = React.memo(function FlyerCard({ flyer, cardHeight, onSave, onShare, onActiveChange, onTagPress, onCategoryPress, onEdit, onDelete }: FlyerCardProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  // Determine ownership: check both the pre-computed flag and live auth
  const isMine = flyer.is_mine === true || (!!user?.id && user.id === flyer.user_id);
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState(flyer.is_saved ?? false);
  useEffect(() => {
    setSaved(flyer.is_saved ?? false);
  }, [flyer.is_saved]);
  const [showLinkWarning, setShowLinkWarning] = useState(false);

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const infoTranslateY = useRef(new Animated.Value(16)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  // Details redesign: progress 0→1 drives image compress + details slide-up
  const detailsProgress = useRef(new Animated.Value(0)).current;
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  const activeRef = useRef(active);
  activeRef.current = active;

  // Derived animated values from detailsProgress
  const imageHeight = detailsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardHeight, cardHeight * 0.5],
  });
  const detailsPanelTranslateY = detailsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardHeight * 0.5, 0],
  });
  const sideIconsOpacity = detailsProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const toggleActive = useCallback(() => {
    const nextActive = !activeRef.current;
    setActive(nextActive);
    onActiveChange?.(nextActive);

    if (nextActive) {
      // Details opening: image compresses instantly, details slide up
      setDetailsLoaded(false);
      setButtonsEnabled(false);

      Animated.parallel([
        // Image compress — fast, CSS-like
        Animated.timing(detailsProgress, {
          toValue: 1,
          duration: 300,
          easing: EASING,
          useNativeDriver: false, // layout animation
        }),
        // Legacy overlay (kept for image dimming)
        Animated.timing(overlayOpacity, {
          toValue: 0.4,
          duration: 220,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1,
          duration: 250,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Simulate content load
        setDetailsLoaded(true);
        // Enable calendar/maps buttons after 100ms delay
        setTimeout(() => setButtonsEnabled(true), 100);
      });
    } else {
      setDetailsLoaded(false);
      setButtonsEnabled(false);

      Animated.parallel([
        Animated.timing(detailsProgress, {
          toValue: 0,
          duration: 220,
          easing: EASING,
          useNativeDriver: false,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1,
          duration: 180,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [detailsProgress, overlayOpacity, imageScale, onActiveChange, cardHeight]);

  const handleSave = useCallback(() => {
    setSaved((prev) => !prev);
    onSave?.(flyer.id);
  }, [flyer.id, onSave]);

  const handleShare = useCallback(async () => {
    try {
      const origin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://thepages.app';
      // Share targets the EventGroup if grouped, otherwise the specific post
      const shareId = flyer.event_group_id || flyer.id;
      const pagesUrl = `${origin}/event/${shareId}`;
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

  // Dispute: "Not the same event" — detaches post from group at 5 disputes
  const handleDispute = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        Alert.alert('Sign In Required', 'You need to be signed in to report this.');
        return;
      }
      const { error } = await supabase.from('disputes').insert({
        event_post_id: flyer.id,
        reported_by: authUser.id,
      });
      if (error) {
        if (error.code === '23505') {
          // Unique violation — already disputed
          Alert.alert('Already Reported', "You've already reported this as a different event.");
        } else {
          throw error;
        }
        return;
      }
      Alert.alert('Thanks', "We'll review whether this belongs in this group.");
    } catch {
      Alert.alert('Error', 'Could not submit. Please try again.');
    }
  }, [flyer.id]);

  const handleMore = useCallback(() => {
    // isMine is already computed at the component level
    const isGrouped = !!flyer.event_group_id;

    if (Platform.OS === 'ios') {
      const options = isMine
        ? ['Cancel', 'Edit Event', 'Delete Event']
        : isGrouped
          ? ['Cancel', 'Report this flyer', 'Not the same event', "Don't show me this again", "Don't show from this poster"]
          : ['Cancel', 'Report this flyer', "Don't show me this again", "Don't show from this poster"];
      const destructiveIndex = isMine ? 2 : 1;

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: destructiveIndex },
        (buttonIndex) => {
          if (isMine) {
            if (buttonIndex === 1) onEdit?.(flyer);
            else if (buttonIndex === 2) handleDelete();
          } else if (isGrouped) {
            if (buttonIndex === 1) setShowReport(true);
            else if (buttonIndex === 2) handleDispute();
            else if (buttonIndex === 3) Alert.alert('Hidden', "You won't see this event again.");
            else if (buttonIndex === 4) Alert.alert('Poster Hidden', "You won't see events from this poster anymore.");
          } else {
            if (buttonIndex === 1) setShowReport(true);
            else if (buttonIndex === 2) Alert.alert('Hidden', "You won't see this event again.");
            else if (buttonIndex === 3) Alert.alert('Poster Hidden', "You won't see events from this poster anymore.");
          }
        }
      );
    } else if (Platform.OS === 'web') {
      if (isMine) {
        setShowWebMenu(true);
      } else {
        setShowReport(true);
      }
    } else {
      const baseButtons = isMine
        ? [
            { text: 'Edit Event', onPress: () => onEdit?.(flyer) },
            { text: 'Delete Event', onPress: handleDelete, style: 'destructive' as const },
            { text: 'Cancel', style: 'cancel' as const },
          ]
        : [
            { text: 'Report this flyer', onPress: () => setShowReport(true), style: 'destructive' as const },
            ...(isGrouped ? [{ text: 'Not the same event', onPress: handleDispute }] : []),
            { text: "Don't show me this again", onPress: () => Alert.alert('Hidden', "You won't see this event again.") },
            { text: "Don't show from this poster", onPress: () => Alert.alert('Poster Hidden', "You won't see events from this poster anymore.") },
            { text: 'Cancel', style: 'cancel' as const },
          ];
      Alert.alert('Options', undefined, baseButtons);
    }
  }, [flyer, isMine, onEdit, handleDelete, handleDispute]);

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
      // Ensure URL has a protocol — without it, browsers open a relative/blank page
      let url = flyer.event_url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        Linking.openURL(url);
      }
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
    <View style={[styles.card, { width, height: cardHeight }]}>
      {/* ─── Image Area (compresses to 35% in details) ─── */}
      <TouchableWithoutFeedback onPress={toggleActive}>
        <Animated.View style={[styles.imageArea, { height: imageHeight }]}>
          {/* Blur background */}
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
                  blurRadius={15}
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

          {/* Main flyer image */}
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

          {/* Dark overlay (subtle dimming in details) */}
          <Animated.View
            style={[
              styles.darkOverlay,
              { opacity: overlayOpacity },
            ]}
          />

          {/* Mini title overlaid on compressed image (details only) */}
          {active && (
            <View style={styles.miniTitleOverlay}>
              <Text style={styles.miniTitleText} numberOfLines={1}>{flyer.title}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* ─── Details Panel (slides up, covers bottom ~65%) ─── */}
      {active && (
        <Animated.View
          style={[
            styles.detailsPanel,
            { height: cardHeight * 0.5, transform: [{ translateY: detailsPanelTranslateY }] },
          ]}
        >
          {!detailsLoaded ? (
            /* Loading spinner while content loads */
            <View style={styles.detailsSpinner}>
              <ActivityIndicator size="small" color={COLORS.text60} />
            </View>
          ) : (
            /* Details content — fades in */
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Category label */}
              <TouchableOpacity
                style={styles.categoryBadge}
                activeOpacity={0.7}
                onPress={() => {
                  toggleActive();
                  onCategoryPress?.(flyer.category);
                }}
              >
                <Text style={styles.categoryText}>{flyer.category}</Text>
              </TouchableOpacity>

              {/* Event name */}
              <Text
                style={[styles.title, { fontSize: titleFontSize * 0.9, lineHeight: titleFontSize * 1.05 }]}
                numberOfLines={2}
              >
                {flyer.title}
              </Text>

              {/* Venue — tappable, opens Maps */}
              {flyer.location ? (
                <TouchableOpacity
                  activeOpacity={buttonsEnabled ? 0.7 : 1}
                  disabled={!buttonsEnabled}
                  onPress={() => {
                    const query = encodeURIComponent(flyer.location!);
                    const url = Platform.select({
                      ios: `maps:0,0?q=${query}`,
                      android: `geo:0,0?q=${query}`,
                      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
                    });
                    if (url) {
                      if (Platform.OS === 'web') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } else {
                        Linking.openURL(url);
                      }
                    }
                  }}
                >
                  <Text style={styles.detailsVenue}>{flyer.location}</Text>
                </TouchableOpacity>
              ) : null}

              {/* Date / Time — tappable, opens Calendar */}
              {flyer.date_text ? (
                <TouchableOpacity
                  activeOpacity={buttonsEnabled ? 0.7 : 1}
                  disabled={!buttonsEnabled}
                  onPress={() => {
                    const title = encodeURIComponent(flyer.title || 'Event');
                    const location = encodeURIComponent(flyer.location || '');
                    const details = encodeURIComponent(
                      [flyer.subtitle, flyer.event_url ? `Link: ${flyer.event_url}` : '', `Found on The Pages`]
                        .filter(Boolean).join('\n')
                    );
                    const dateText = encodeURIComponent(flyer.date_text || '');
                    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateText}&location=${location}&details=${details}`;
                    if (Platform.OS === 'web') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                      Linking.openURL(url);
                    }
                  }}
                >
                  <Text style={styles.detailsDateTime}>{flyer.date_text}</Text>
                </TouchableOpacity>
              ) : null}

              {/* Caption with accent border */}
              {flyer.description ? (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionText}>{flyer.description}</Text>
                </View>
              ) : flyer.subtitle ? (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionText}>{flyer.subtitle}</Text>
                </View>
              ) : null}


              {/* CTA */}
              {flyer.link ? (
                <TouchableOpacity
                  style={styles.ctaButton}
                  activeOpacity={0.8}
                  onPress={handleCTA}
                >
                  <Text style={styles.ctaText}>{flyer.link}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}

          {/* Side icons — inside details panel, right edge */}
          {detailsLoaded ? (
            <Animated.View style={[styles.sideIcons, { opacity: sideIconsOpacity }]}>
              {/* User avatar */}
              {flyer.profile && !flyer.is_anonymous ? (
                <TouchableOpacity
                  style={styles.sideIconButton}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/profile/${flyer.profile!.id}`)}
                >
                  {flyer.profile.avatar_url ? (
                    <Image source={{ uri: flyer.profile.avatar_url }} style={styles.sideAvatar} />
                  ) : (
                    <View style={[styles.sideAvatarFallback, { backgroundColor: flyer.profile.avatar_color || '#EB736C' }]}>
                      <Text style={styles.sideAvatarInitial}>{flyer.profile.avatar_initials || '?'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* Save */}
              <TouchableOpacity style={styles.sideIconButton} onPress={handleSave} activeOpacity={0.7}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z"
                    stroke="#fff" strokeWidth={1.5} fill={saved ? '#EB736C' : 'none'}
                  />
                </Svg>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity style={styles.sideIconButton} onPress={handleShare} activeOpacity={0.7}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3v12M12 3l4 4M12 3L8 7M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                    stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>

              {/* More */}
              <TouchableOpacity style={styles.sideIconButton} onPress={handleMore} activeOpacity={0.7}>
                <MoreIcon />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Hashtag pills — pinned to bottom, horizontal scroll */}
          {flyer.tags && flyer.tags.length > 0 && detailsLoaded ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsScrollContainer}
              contentContainerStyle={styles.tagsScrollContent}
            >
              {flyer.tags.map((tag, index) => {
                const color = TAG_COLORS[index % TAG_COLORS.length];
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagPill, { backgroundColor: color.bg }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      toggleActive();
                      onTagPress?.(tag);
                    }}
                  >
                    <Text style={[styles.tagText, { color: color.text }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
        </Animated.View>
      )}

      {/* Action rail — browse state only */}
      {!active && (
        <ActionRail
          visible={true}
          onSave={handleSave}
          onShare={handleShare}
          isSaved={saved}
        />
      )}

        {/* Visibility badge — colored indicator for non-public posts */}
        {flyer.visibility && flyer.visibility !== 'public' && (
          <View style={[
            styles.visibilityBadge,
            { backgroundColor: flyer.visibility === 'mutuals'
              ? 'rgba(233,210,94,0.85)'
              : 'rgba(235,115,108,0.85)'
            },
          ]}>
            <View style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: '#fff',
            }} />
            <Text style={styles.visibilityBadgeText}>
              {flyer.visibility === 'mutuals' ? 'MUTUALS' : 'FOLLOWERS'}
            </Text>
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
  );
});

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

  /* Image area */
  imageArea: {
    position: 'relative',
    overflow: 'hidden',
    zIndex: 2,
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

  /* Mini title on compressed image */
  miniTitleOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  miniTitleText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Details panel — slides up from bottom */
  detailsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.dark,
    zIndex: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  detailsSpinner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
    paddingRight: 60, // room for side icons
    gap: 6,
  },

  /* Caption with accent border */
  captionContainer: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.coral,
    paddingLeft: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  captionText: {
    fontFamily: FONTS.bodyItalic || FONTS.body,
    fontSize: 14,
    color: COLORS.text70,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  /* Details venue/datetime — underlined to indicate tappable */
  detailsVenue: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text85,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.3)',
  },
  detailsDateTime: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.text60,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.2)',
  },

  /* Calendar/Maps action rows */
  metaActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metaActionDisabled: {
    opacity: 0.4,
  },
  metaActionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text85,
  },

  /* Tags horizontal scroll */
  tagsScrollContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tagsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },

  /* Side icons — inside details panel, right edge */
  sideIcons: {
    position: 'absolute',
    right: 10,
    top: 12,
    zIndex: 20,
    alignItems: 'center',
    gap: 6,
  },
  sideIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
  },
  sideAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  sideAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideAvatarInitial: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: '#ffffff',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0.5,
    borderColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 4,
  },
  categoryText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#ffffff',
    lineHeight: 14,
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
  visibilityBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    zIndex: 5,
  },
  visibilityBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: '#fff',
    fontWeight: '600',
  },
});
