import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';
import type { Post, Profile } from '../../types';

/**
 * Standalone event page for shared links (/event/[id]).
 * Fetches the post from Supabase and displays it directly.
 * Also works as a fallback if the Vercel API rewrite doesn't fire.
 */
export default function EventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      try {
        setLoading(true);
        const { data, error: fetchErr } = await supabase
          .from('posts')
          .select(`
            *,
            profile:profiles!posts_user_id_fkey(
              id, handle, display_name, avatar_url, avatar_color, avatar_initials
            )
          `)
          .eq('id', id)
          .eq('is_public', true)
          .single();

        if (fetchErr || !data) {
          setError('Event not found');
          return;
        }
        setPost(data);
      } catch {
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  const handleOpenInFeed = () => {
    router.replace({ pathname: '/(tabs)', params: { focus: id } });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.red} style={{ marginTop: 80 }} />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error || 'Event not found'}</Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/')}>
          <Text style={styles.browseButtonText}>BROWSE EVENTS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bgColor = post.bg_color || '#1a1a2e';
  const textColor = post.text_color || '#ffffff';
  const accentColor = post.accent_color || COLORS.red;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      >
        {/* Flyer image */}
        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            style={[styles.flyerImage, { width: width - 32 }]}
            resizeMode="cover"
          />
        ) : null}

        {/* Title */}
        <Text style={[styles.title, { color: textColor }]}>{post.title}</Text>

        {/* Subtitle */}
        {post.subtitle ? (
          <Text style={[styles.subtitle, { color: textColor, opacity: 0.8 }]}>{post.subtitle}</Text>
        ) : null}

        {/* Date */}
        {post.date_text ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: accentColor }]}>WHEN</Text>
            <Text style={[styles.metaValue, { color: textColor }]}>{post.date_text}</Text>
          </View>
        ) : null}

        {/* Location */}
        {post.location ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: accentColor }]}>WHERE</Text>
            <Text style={[styles.metaValue, { color: textColor }]}>{post.location}</Text>
          </View>
        ) : null}

        {/* Description */}
        {post.description ? (
          <Text style={[styles.description, { color: textColor, opacity: 0.85 }]}>{post.description}</Text>
        ) : null}

        {/* Event link */}
        {post.event_url ? (
          <TouchableOpacity
            style={[styles.linkButton, { borderColor: accentColor }]}
            activeOpacity={0.8}
            onPress={() => {
              let url = post.event_url.trim();
              if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
              if (Platform.OS === 'web') {
                window.open(url, '_blank', 'noopener,noreferrer');
              } else {
                Linking.openURL(url);
              }
            }}
          >
            <Text style={[styles.linkButtonText, { color: accentColor }]}>GET TICKETS</Text>
          </TouchableOpacity>
        ) : null}

        {/* Posted by */}
        {post.profile && !post.is_anonymous ? (
          <TouchableOpacity
            style={styles.postedBy}
            activeOpacity={0.7}
            onPress={() => router.push(`/profile/${post.profile.id}`)}
          >
            {post.profile.avatar_url ? (
              <Image source={{ uri: post.profile.avatar_url }} style={styles.postedByAvatar} />
            ) : (
              <View style={[styles.postedByAvatarFallback, { backgroundColor: post.profile.avatar_color || '#EB736C' }]}>
                <Text style={styles.postedByInitial}>{post.profile.avatar_initials || '?'}</Text>
              </View>
            )}
            <Text style={[styles.postedByText, { color: textColor, opacity: 0.5 }]}>
              {post.profile.display_name || post.profile.handle || 'someone'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Bottom bar — open in feed */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.feedButton} activeOpacity={0.8} onPress={handleOpenInFeed}>
          <Text style={styles.feedButtonText}>OPEN IN THE PAGES</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginTop: 80,
    letterSpacing: 1,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'center',
  },
  browseButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1.5,
  },
  flyerImage: {
    aspectRatio: 4 / 5,
    borderRadius: 0,
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    gap: 10,
    alignSelf: 'stretch',
  },
  metaLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 2,
    width: 60,
  },
  metaValue: {
    fontFamily: FONTS.body,
    fontSize: 15,
    flex: 1,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  linkButton: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
    marginBottom: 20,
  },
  linkButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  postedBy: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postedByAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  postedByAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postedByInitial: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#fff',
  },
  postedByText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  feedButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    alignItems: 'center',
  },
  feedButtonText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 2,
  },
});
