import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationPayload {
  alertId?: string;
  systemId?: string;
  variableName?: string;
  value?: number;
  unit?: string;
  direction?: string;
  timestamp?: string;
  title?: string;
  body?: string;
  [key: string]: any;
}

export interface NotificationData {
  title: string;
  body: string;
  data: NotificationPayload;
  received: Date;
}

class PushNotificationController {
  private notificationListenerSubscription: Notifications.EventSubscription | null = null;
  private responseListenerSubscription: Notifications.EventSubscription | null = null;

  /**
   * Initialize push notifications
   * - Requests permissions
   * - Gets FCM token
   * - Sets up listeners for foreground/background notifications
   */
  async initialize(): Promise<string | null> {
    try {
      // Request notification permissions
      const granted = await this.requestPermissions();
      if (!granted) {
        console.warn('Notification permissions not granted');
        return null;
      }

      // Get and store the native device push token
      const token = await this.getFCMToken();
      if (token) {
        console.log('[PushNotifications] FCM token obtenido:', token);
        // Store token for later use (e.g., send to backend)
        await this.storeFCMToken(token);
      }

      // Set up listeners
      this.setupNotificationListeners();

      console.log('Push notifications initialized successfully');
      return token;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return null;
    }
  }

  /**
   * Request notification permissions from user
   */
  private async requestPermissions(): Promise<boolean> {
    try {
      const finalStatus = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      return finalStatus.status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get FCM token for Firebase Cloud Messaging
   * This token is needed to send push notifications to this device
   */
  private async getFCMToken(): Promise<string | null> {
    try {
      const token = await Notifications.getDevicePushTokenAsync();

      if (Platform.OS === 'android') {
        console.log('[PushNotifications] Android FCM token:', token.data);
      } else {
        console.log('[PushNotifications] iOS APNs token:', token.data);
      }

      return token.data;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Store FCM token in AsyncStorage for later use
   * (e.g., to send to your backend for push notification targeting)
   */
  private async storeFCMToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('fcm_token', token);
      const storedToken = await AsyncStorage.getItem('fcm_token');
      console.log('FCM Token stored:', storedToken);
    } catch (error) {
      console.error('Error storing FCM token:', error);
    }
  }

  /**
   * Get stored FCM token
   */
  async getFCMTokenFromStorage(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('fcm_token');
    } catch (error) {
      console.error('Error retrieving FCM token:', error);
      return null;
    }
  }

  /**
   * Set up notification listeners for foreground and background
   */
  private setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    this.notificationListenerSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.handleNotificationReceived(notification);
      }
    );

    // Handle user tapping on notification
    this.responseListenerSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        this.handleNotificationResponse(response);
      });
  }

  /**
   * Handle notification received in foreground
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('📱 Notification received:', notification);

    const payload: NotificationData = {
      title: notification.request.content.title || 'Alerta',
      body: notification.request.content.body || '',
      data: (notification.request.content.data as NotificationPayload) || {},
      received: new Date(),
    };

    // You can trigger UI updates here
    // For example: show a banner, update state, etc.
    this.onNotificationReceived?.(payload);
  }

  /**
   * Handle user interaction with notification (tap)
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    console.log('👆 User interacted with notification:', response);

    const payload: NotificationData = {
      title: response.notification.request.content.title || 'Alerta',
      body: response.notification.request.content.body || '',
      data: (response.notification.request.content.data as NotificationPayload) || {},
      received: new Date(),
    };

    // Navigate to relevant screen or update state
    this.onNotificationResponse?.(payload);
  }

  /**
   * Send a local test notification
   * Useful for testing the notification system
   */
  async sendTestNotification(
    title: string = 'Alerta de Terrafy',
    body: string = 'Esta es una notificación de prueba',
    data: NotificationPayload = {}
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          badge: 1,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  /**
   * Clean up listeners
   */
  destroy(): void {
    if (this.notificationListenerSubscription) {
      this.notificationListenerSubscription.remove();
    }
    if (this.responseListenerSubscription) {
      this.responseListenerSubscription.remove();
    }
  }

  // Callbacks for handling notifications
  onNotificationReceived?: (notification: NotificationData) => void;
  onNotificationResponse?: (notification: NotificationData) => void;
}

// Export singleton instance
export const pushNotificationController = new PushNotificationController();
