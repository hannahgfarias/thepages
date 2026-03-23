import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { FONTS } from '../constants/fonts';

const EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface ToastContextValue {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setMessage(msg);
      translateY.setValue(-100);
      opacity.setValue(0);

      // Slide in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 2.2s
      timeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            easing: EASING,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            easing: EASING,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setMessage(null);
        });
      }, 2200);
    },
    [translateY, opacity]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message !== null && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.toast}>
            <Text style={styles.toastText}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  toastText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: '#ffffff',
  },
});
