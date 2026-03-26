import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { FONTS } from '../../constants/fonts';
import { COLORS } from '../../constants/colors';

export default function EventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          *,
          profile:profiles!posts_user_id_fkey (
            handle, display_name, avatar_color, avatar_initials
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !data) {
        setError(true);
      } else {
        setPost(data);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.errorTitle}>Event not found</Text>
        <Text style={styles.errorSubtitle}>This flyer may have been removed.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Text style={styles.backButtonText}>GO TO FEED</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bgColor = post.bg_color || '#1a1a2e';
  const textColor = post.text_color || '#ffffff';
  const accentColor = post.accent_color || '#E63946';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Back to feed */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={textColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.navButtonText, { color: textColor }]}>THE PAGES</Text>
        </TouchableOpacity>

        {/* Flyer image */}
        {post.image_url && (
          <Image
            source={{ uri: post.image_url }}
            style={[styles.flyerImage, { width: width - 48 }]}
            resizeMode="cover"
          />
        )}

        {/* Event details */}
        <Text style={[styles.title, { color: textColor }]}>{post.title}</Text>

        {post.subtitle && (
          <Text style={[styles.subtitle, { color: textColor, opacity: 0.8 }]}>{post.subtitle}</Text>
        )}

        {post.date_text && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailText, { color: textColor, opacity: 0.7 }]}>{post.date_text}</Text>
          </View>
        )}

        {post.location && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailText, { color: textColor, opacity: 0.7 }]}>{post.location}</Text>
          </View>
        )}

        {post.description && (
          <Text style={[styles.description, { color: textColor, opacity: 0.7 }]}>{post.description}</Text>
        )}

        {/* Event link */}
        {post.event_url && (
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: accentColor }]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.open(post.event_url, '_blank');
              } else {
                const Linking = require('expo-linking');
                Linking.openURL(post.event_url);
              }
            }}
          >
            <Text style={styles.linkButtonText}>GET TICKETS</Text>
          </TouchableOpacity>
        )}

        {/* Posted by */}
        {post.profile && !post.is_anonymous && (
          <Text style={[styles.postedBy, { color: textColor, opacity: 0.4 }]}>
            Posted by {post.profile.display_name || post.profile.handle}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 100,
  },
  errorTitle: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 100,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'center',
    backgroundColor: COLORS.red,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 0,
  },
  backButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
    color: '#ffffff',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  navButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
  },
  flyerImage: {
    aspectRatio: 4 / 5,
    borderRadius: 0,
    marginBottom: 20,
    alignSelf: 'center',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 6,
  },
  detailText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
    marginBottom: 20,
  },
  linkButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  linkButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
    color: '#ffffff',
  },
  postedBy: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginTop: 12,
  },
});
