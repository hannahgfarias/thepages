import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  SectionList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { useAuth } from '../hooks/useAuth';
import { FONTS } from '../constants/fonts';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

export interface CommunityMember {
  id: string;
  name: string;
  handle: string;
  color: string;
  initials: string;
  status: 'mutual' | 'following' | 'follows_you' | 'request';
}

const STATUS_LABELS: Record<string, string> = {
  mutual: 'Community',
  following: 'Following',
  follows_you: 'Follows you',
};

// Hook to fetch community data — exported so ProfilePanel can check request count
export function useCommunityData() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<CommunityMember[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCommunity = useCallback(async () => {
    if (!session?.user?.id) {
      setRequests([]);
      setMembers([]);
      return;
    }

    setLoading(true);
    try {
      // TODO: Fetch real follow requests and community members from Supabase
      // For now, return empty arrays until the follows table is created
      setRequests([]);
      setMembers([]);
    } catch (e) {
      console.warn('Community fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  return { requests, setRequests, members, setMembers, loading, refetch: fetchCommunity };
}

export function CommunitySheet() {
  const { showCommunity, setShowCommunity } = useOverlay();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { requests, setRequests, members } = useCommunityData();

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCommunity) {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 250,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 200,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideY.setValue(height);
      scrimOpacity.setValue(0);
    }
  }, [showCommunity, slideY, scrimOpacity, height]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: height,
        duration: 220,
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
      setShowCommunity(false);
    });
  };

  const handleAcceptRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    // TODO: Supabase update follow status
  };

  const handleDeclineRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    // TODO: Supabase delete follow request
  };

  const sections = [
    ...(requests.length > 0
      ? [{ title: 'FOLLOW REQUESTS', data: requests }]
      : []),
    ...(members.length > 0
      ? [{ title: 'YOUR COMMUNITY', data: members }]
      : []),
  ];

  const renderItem = ({ item }: { item: CommunityMember }) => (
    <View style={styles.memberRow}>
      {/* Avatar */}
      <View style={[styles.memberAvatar, { backgroundColor: item.color }]}>
        <Text style={styles.memberInitials}>{item.initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberHandle}>{item.handle}</Text>
      </View>

      {/* Actions based on status */}
      {item.status === 'request' ? (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            activeOpacity={0.7}
            onPress={() => handleAcceptRequest(item.id)}
          >
            <Text style={styles.acceptText}>ACCEPT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineButton}
            activeOpacity={0.7}
            onPress={() => handleDeclineRequest(item.id)}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#02040F" strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      ) : item.status === 'follows_you' ? (
        <TouchableOpacity style={styles.followBackButton} activeOpacity={0.7}>
          <Text style={styles.followBackText}>FOLLOW BACK</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
        </View>
      )}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.title === 'FOLLOW REQUESTS' && (
        <View style={styles.requestBadge}>
          <Text style={styles.requestBadgeText}>{requests.length}</Text>
        </View>
      )}
    </View>
  );

  if (!showCommunity) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      {/* Scrim */}
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
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
            maxHeight: height * 0.75,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header with close */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>COMMUNITY</Text>
          <TouchableOpacity
            style={styles.closeButton}
            activeOpacity={0.7}
            onPress={handleClose}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#02040F" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Sectioned list */}
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No community yet</Text>
            <Text style={styles.emptySubtitle}>
              When people follow you or you follow others, they'll appear here.
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 200,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0ECEC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 201,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(2,4,15,0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: '#02040F',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 24,
    width: 28,
    height: 28,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.15)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,4,15,0.06)',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: 'rgba(2,4,15,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  requestBadge: {
    backgroundColor: '#E9D25E',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBadgeText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: '#02040F',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: '#ffffff',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#02040F',
    fontWeight: '600',
  },
  memberHandle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: 'rgba(2,4,15,0.35)',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.12)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: 'rgba(2,4,15,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#E9D25E',
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  acceptText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#02040F',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  declineButton: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: 'rgba(2,4,15,0.12)',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBackButton: {
    borderWidth: 1,
    borderColor: '#02040F',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  followBackText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: '#02040F',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: '#02040F',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(2,4,15,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});
