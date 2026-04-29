# Firebase Cloud Messaging Setup para Expo

Este documento describe cómo configurar Firebase Cloud Messaging (FCM) en tu app de Expo manejada.

## Diferencias con React Native Puro

Tu app usa **Expo manejado**, no bare workflow. Esto significa:
- ✅ Usamos `expo-notifications` (no `react-native-push-notification`)
- ✅ La configuración va en `app.json` y `eas.json` (no en `build.gradle`)
- ✅ Expo maneja la compilación nativa automáticamente
- ✅ El `google-services.json` se inyecta via EAS Build

## Pasos de Configuración

### 1. Descargar Firebase Service Account

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. **Project Settings** → **Service Accounts**
4. Click en **Generate new private key** (descargará JSON con credenciales)
5. Guarda este archivo en un lugar seguro (nunca lo commits a Git)

### 2. Agregar Firebase Project ID a `app.json`

Abre `app.json` y agrega tu Firebase Project ID en la sección `extra`:

```json
{
  "expo": {
    "name": "Terrafy",
    "slug": "Terrafy",
    ...
    "extra": {
      "eas": {},
      "firebaseProjectId": "your-firebase-project-id"
    }
  }
}
```

**Donde obtener el Project ID:**
- Firebase Console → Project Settings
- Es el valor en "Project ID" (ejemplo: `terrafy-12345`)

### 3. Configurar `eas.json` para Android

Edita `eas.json` y agrega la configuración de Android:

```json
{
  "cli": {
    "version": ">= 18.4.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 4. Configurar `app.json` para Android Notifications

Agrega la configuración de notificaciones en `app.json`:

```json
{
  "expo": {
    ...
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#E6F4FE",
          "sounds": [
            "./assets/notification-sound.wav"
          ]
        }
      ],
      ...
    ]
  }
}
```

### 5. (Opcional) Agregar google-services.json

Si necesitas acceso directo a Firebase (para features avanzados), puedes agregar `google-services.json`:

1. Descarga de Firebase Console → Project Settings → Google Services
2. Coloca en el directorio raíz del proyecto: `google-services.json`
3. Agrega a `eas.json`:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "aab",
        "env": {
          "ANDROID_PACKAGE_ID": "com.callmedrift.Terrafy"
        }
      }
    }
  }
}
```

## Configuración en Código

El controlador ya está implementado en `services/push-notification-controller.ts`. Se inicializa automáticamente en `app/_layout.tsx`.

### Solicitar Permisos

Los permisos se solicitan automáticamente al inicializar, pero puedes controlarlos manualmente:

```typescript
import { pushNotificationController } from '@/services/push-notification-controller';

// La inicialización ocurre automáticamente, pero puedes forzarla:
await pushNotificationController.initialize();

// Obtener el FCM token almacenado
const fcmToken = await pushNotificationController.getFCMTokenFromStorage();
console.log('FCM Token:', fcmToken);
```

### Manejar Notificaciones Recibidas

Puedes reaccionar cuando se recibe una notificación:

```typescript
import { pushNotificationController } from '@/services/push-notification-controller';

// En tu componente
useEffect(() => {
  pushNotificationController.onNotificationReceived = (notification) => {
    console.log('Nueva notificación recibida:', notification.title, notification.body);
    // Actualizar estado, navegar, etc.
    console.log('Datos:', notification.data);
  };

  pushNotificationController.onNotificationResponse = (notification) => {
    console.log('Usuario tocó la notificación:', notification.title);
    // Navegar a la pantalla relevante
  };
}, []);
```

### Enviar Notificación de Prueba

Para probar localmente:

```typescript
import { pushNotificationController } from '@/services/push-notification-controller';

// En tu componente
const handleTestNotification = async () => {
  await pushNotificationController.sendTestNotification(
    'Alerta de Umbral',
    'La variable Humedad superó el umbral máximo',
    {
      systemId: '123',
      variableName: 'Humedad',
      value: 85,
      unit: '%',
      direction: 'max',
      alertId: 'alert-456'
    }
  );
};
```

## Integración con Tu Sistema de Alertas

Para conectar notificaciones push con tu sistema de alertas:

### 1. Enviar FCM Token al Backend

Después de obtener el token, envíalo a tu backend:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/router';

export const sendFCMTokenToBackend = async () => {
  try {
    const token = await pushNotificationController.getFCMTokenFromStorage();
    const userToken = await AsyncStorage.getItem('userToken');
    
    if (!token) return;

    await fetch(`${API_URL}/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ fcmToken: token }),
    });
  } catch (error) {
    console.error('Error sending FCM token:', error);
  }
};
```

### 2. Backend envía notificaciones al crear alertas

Tu backend debe enviar a FCM cuando se genera una nueva alerta:

```javascript
// Ejemplo en Node.js/Firebase Admin SDK
const admin = require('firebase-admin');

async function sendAlertNotification(fcmToken, alert) {
  const message = {
    notification: {
      title: `Alerta: ${alert.variableName}`,
      body: `Valor ${alert.value}${alert.unit} está por ${alert.direction === 'max' ? 'arriba' : 'abajo'} del umbral`,
    },
    data: {
      alertId: alert.id,
      systemId: alert.systemId,
      variableName: alert.variableName,
      value: String(alert.value),
      unit: alert.unit,
      direction: alert.direction,
      timestamp: alert.timestamp,
    },
    token: fcmToken,
  };

  await admin.messaging().send(message);
}
```

## Pruebas

### Prueba Local (Sin Firebase)

1. Usa notificaciones locales para desarrollar:
```typescript
await pushNotificationController.sendTestNotification(
  'Test',
  'This is a test notification'
);
```

2. Verifica en la consola que los logs aparezcan

### Prueba con FCM (Desde Firebase Console)

1. Ve a Firebase Console → Engage → Cloud Messaging
2. Click "Send your first message"
3. Ingresa título y descripción
4. Click "Send test message"
5. Selecciona el device token del usuario
6. Observa la notificación en el dispositivo

### Prueba en Dispositivo Real

1. Compila y ejecuta en un device real:
```bash
eas build --platform android --profile preview
# O instala la app de desarrollo
expo start --android
```

2. La app solicitará permisos de notificación
3. Acepta los permisos
4. Verifica que el FCM token se haya guardado
5. Envía una notificación desde Firebase Console

## Android 13+ Permisos POST_NOTIFICATIONS

Para Android 13+, el usuario debe otorgar permiso `POST_NOTIFICATIONS`. Esto se solicita automáticamente, pero puedes verificar el estado:

```typescript
import * as Notifications from 'expo-notifications';

const checkPermissionStatus = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  console.log('Permission status:', status);
  // 'granted' | 'denied' | 'undetermined'
};
```

## iOS Requisitos

Para iOS, no es necesaria configuración adicional en Expo manejado, pero el usuario debe:
1. Aceptar el prompt de notificaciones cuando la app inicie
2. Habilitar notificaciones en Settings > Terrafy > Notifications

## Troubleshooting

### "FCM Token not obtained"
- Asegúrate de que el Firebase Project ID esté en `app.json`
- Verifica que el dispositivo sea real (simulador no soporta notificaciones)
- Compila una nueva build: `eas build --platform android --profile preview`

### Notificaciones no aparecen
- Verifica que los permisos estén otorgados
- Comprueba que la app está correctamente identificada en FCM
- Revisa los logs en Firebase Console

### Token keeps changing
- Los tokens pueden cambiar ocasionalmente, tu backend debe actualizar el almacenamiento

## Referencias

- [expo-notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
