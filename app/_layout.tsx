import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { pushNotificationController } from '@/services/push-notification-controller';
import { ChatbotPanel } from './(options)/chatbot';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ systemId?: string }>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { width, height } = Dimensions.get('window');
  const isAuthScreen = pathname === '/' || pathname === '/index' || pathname === '/register';
  const isDetailedSystem = pathname.includes('detailed-system');

  const startX = Math.max(16, width - 76);
  const startY = Math.max(80, height - 180);
  const dragPosition = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          dragPosition.setOffset({
            x: (dragPosition.x as any)._value,
            y: (dragPosition.y as any)._value,
          });
          dragPosition.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: dragPosition.x, dy: dragPosition.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          dragPosition.flattenOffset();
        },
      }),
    [dragPosition]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    // Initialize push notifications on app launch
    const initializePushNotifications = async () => {
      await pushNotificationController.initialize();
    };

    initializePushNotifications();

    // Cleanup on unmount
    return () => {
      pushNotificationController.destroy();
    };
  }, []);

  useEffect(() => {
    if (isAuthScreen) {
      setIsChatOpen(false);
    }
  }, [isAuthScreen]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(options)" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      {isDetailedSystem && (
        <>
          <View pointerEvents="box-none" style={styles.fabOverlay}>
            <Animated.View
              style={[
                styles.fabDragLayer,
                {
                  transform: [{ translateX: dragPosition.x }, { translateY: dragPosition.y }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setIsChatOpen((prev) => !prev)}
                style={styles.globalFab}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color="#ffffff" />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Modal visible={isChatOpen} transparent animationType="fade" onRequestClose={() => setIsChatOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setIsChatOpen(false)}>
              <Pressable style={styles.modalContent} onPress={(event) => event.stopPropagation()}>
                <ChatbotPanel onClose={() => setIsChatOpen(false)} systemId={params.systemId} />
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fabOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  fabDragLayer: {
    position: 'absolute',
  },
  globalFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#166534',
    borderWidth: 2,
    borderColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
  },
});
