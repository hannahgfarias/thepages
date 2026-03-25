import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  SectionList,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useOverlay } from '../app/(tabs)/_layout';
import { FONTS } from '../constants/fonts';
import { COLORS } from '../constants/colors';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface CommunityMember {
  id: string;
  name: string;
  handle: string;
  color: string;
  initials: string;
  status: 'mutual' | 'following' | 'follows_you' | 'request';
}

const FOLLOW_REQUESTS: CommunityMember[] = [
  { id: 'r1', name: 'Nadia Osei', handle: '@nadia.o', color: '#f472b6', initials: 'NO', status: 'request' },
  { id: 'r2', name: 'Tyler Chen', handle: '@tyler_c', color: '#818cf8', initials: 'TC', status: 'request' },
];

const COMMUNITY_MEMBERS: CommunityMember[] = [
  { id: '1', name: 'Marco Rivera', handle: '@marco_r', color: '#6366f1', initials: 'MR', status: 'mutual' },
  { id: '2', name: 'Kai Tanaka', handle: '@kai.t', color: '#14b8a6', initials: 'KT', status: 'follows_you' },
  { id: '3', name: 'Jasmine Lee', handle: '@jas_lee', color: '#f59e0b', initials: 'JL', status: 'mutual' },
  { id: '4', name: 'Alex Park', handle: '@a.park', color: '#ec4899', initials: 'AP', status: 'following' },
  { id: '5', name: 'Sam Rodriguez', handle: '@samrod', color: '#8b5cf6', initials: 'SR', status: 'mutual' },
  { id: '6', name: 'Dana Williams', handle: '@danaw', color: '#06b6d4', initials: 'DW', status: 'follows_you' },
  { id: '7', name: 'River Green', handle: '@river.g', color: '#10b981', initials: 'RG', status: 'following' },
];

const STATUS_LABELS: Record<string, string> = {
  mutual: 'Community',
  following: 'Following',
  follows_you: 'Follows you',
};

export function CommunitySheet() {
  const { showCommunity, setShowCommunity } = useOverlay();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [requests, setRequests] = useState(FOLLOW_REQUESTS);

  const slideY = useRef(new Animated.Value(height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCommunity) {
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
  }, [showCommunity, slideY, scrimOpacity, height]);

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
    { title: 'YOUR COMMUNITY', data: COMMUNITY_MEMBERS },
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
        <TouchableOpacity
          style={styles.followBackButton}
          activeOpacity={0.7}
          onPress={() => {
            // TODO: Supabase update follow status to mutual
            Alert.alert('Following', `You're now following ${item.name}`);
          }}
        >
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
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
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
});
