import { API_URL } from '@/constants/router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPayload, pushNotificationController } from './push-notification-controller';

/**
 * Service to integrate push notifications with the alert system
 * Handles:
 * - Sending FCM token to backend
 * - Monitoring alert changes and triggering notifications
 * - Handling notification responses (navigation, etc.)
 */

export interface AlertNotificationConfig {
  systemId: string;
  systemName?: string;
  onAlertNotificationReceived?: (data: NotificationPayload) => void;
  onAlertNotificationTapped?: (data: NotificationPayload) => void;
}

class AlertNotificationService {
  private config: AlertNotificationConfig | null = null;

  /**
   * Initialize the alert notification service
   * Call this after the user is authenticated
   */
  async initialize(config: AlertNotificationConfig): Promise<void> {
    try {
      this.config = config;

      // Send FCM token to backend
      await this.sendFCMTokenToBackend();

      // Set up notification handlers
      this.setupNotificationHandlers();

      console.log('Alert notification service initialized');
    } catch (error) {
      console.error('Error initializing alert notification service:', error);
    }
  }

  /**
   * Send the FCM token to backend for push notification targeting
   */
  private async sendFCMTokenToBackend(): Promise<void> {
    try {
      const fcmToken = await pushNotificationController.getFCMTokenFromStorage();
      const userToken = await AsyncStorage.getItem('userToken');

      if (!fcmToken || !userToken) {
        console.warn('Missing FCM token or user token');
        return;
      }

      const response = await fetch(`${API_URL}/users/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ fcmToken }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send FCM token: ${response.statusText}`);
      }

      console.log('FCM token sent to backend successfully');
    } catch (error) {
      console.error('Error sending FCM token to backend:', error);
    }
  }

  /**
   * Set up handlers for notification events
   */
  private setupNotificationHandlers(): void {
    // Handle notifications received while app is in foreground
    pushNotificationController.onNotificationReceived = (notification) => {
      this.handleAlertNotificationReceived(notification.data);
    };

    // Handle user tapping on notification
    pushNotificationController.onNotificationResponse = (notification) => {
      this.handleAlertNotificationTapped(notification.data);
    };
  }

  /**
   * Handle when a notification is received in foreground
   */
  private handleAlertNotificationReceived(data: NotificationPayload): void {
    console.log('📢 Alert notification received:', data);

    // Only process if it's an alert for our current system
    if (data.systemId && this.config?.systemId === data.systemId) {
      this.config?.onAlertNotificationReceived?.(data);
    }
  }

  /**
   * Handle when user taps on a notification
   */
  private handleAlertNotificationTapped(data: NotificationPayload): void {
    console.log('👆 Alert notification tapped:', data);

    if (data.systemId && this.config?.systemId === data.systemId) {
      this.config?.onAlertNotificationTapped?.(data);
    }
  }

  /**
   * Send a test alert notification (for development/testing)
   */
  async sendTestAlertNotification(variableName: string = 'Humedad'): Promise<void> {
    try {
      const title = `Alerta de Umbral - ${this.config?.systemName || 'Sistema'}`;
      const value = Math.random() * 100;
      const unit = '%';
      const direction = Math.random() > 0.5 ? 'max' : 'min';

      const data: NotificationPayload = {
        alertId: `test-${Date.now()}`,
        systemId: this.config?.systemId || 'test-system',
        systemName: this.config?.systemName,
        variableName,
        value: Math.round(value * 10) / 10,
        unit,
        direction,
        timestamp: new Date().toISOString(),
      };

      const body = `${variableName}: ${data.value}${unit} está por ${
        direction === 'max' ? 'encima del' : 'debajo del'
      } umbral permitido`;

      await pushNotificationController.sendTestNotification(title, body, data);
      console.log('Test alert notification sent');
    } catch (error) {
      console.error('Error sending test alert notification:', error);
    }
  }

  /**
   * Refresh FCM token with backend
   * Call this periodically or after token update
   */
  async refreshFCMToken(): Promise<void> {
    try {
      await this.sendFCMTokenToBackend();
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): AlertNotificationConfig | null {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertNotificationConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    pushNotificationController.onNotificationReceived = undefined;
    pushNotificationController.onNotificationResponse = undefined;
    this.config = null;
  }
}

export const alertNotificationService = new AlertNotificationService();
