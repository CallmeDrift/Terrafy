# 🚀 Firebase Push Notifications - Próximos Pasos

## ✅ Lo que Ya Está Implementado

1. **PushNotificationController** (`services/push-notification-controller.ts`)
   - Maneja la obtención de FCM tokens
   - Configura listeners para notificaciones foreground/background
   - Inicializa automáticamente en el app launch

2. **AlertNotificationService** (`services/alert-notification-service.ts`)
   - Integra notificaciones con tu sistema de alertas
   - Maneja envío de FCM token al backend
   - Procesa callbacks cuando se reciben/tocan notificaciones

3. **Inicialización Automática** (`app/_layout.tsx`)
   - Push notifications se inician cuando la app arranca
   - Cleanup automático al desmontarse

## 📋 Tareas por Completar

### 1. Obtener Firebase Project ID ⚙️
**Ubicación:** Desde Firebase Console  
**Acción:**
```bash
1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto
3. Click en "Project Settings" (engranaje arriba a la izquierda)
4. Ve a la pestaña "General"
5. Copia el "Project ID" (ej: terrafy-12345)
```

**Agregalo a `app.json`:**
```json
{
  "expo": {
    ...
    "extra": {
      "eas": {},
      "firebaseProjectId": "AQUI_TU_PROJECT_ID"
    }
  }
}
```

### 2. Descargar google-services.json (Opcional pero Recomendado)
**Para acceso avanzado a Firebase:**
```bash
1. Firebase Console → Project Settings
2. Descarga google-services.json
3. Coloca en la raíz del proyecto: ./google-services.json
```

### 3. Integrar AlertNotificationService en tu App
**Ubicación:** `app/(options)/detailed-system.tsx`  
**Acción:** Ver `INTEGRATION_EXAMPLE.md` para el código exacto a agregar

Esto incluye:
- Inicializar el servicio cuando el usuario ve un sistema
- Mostrar notificaciones cuando se reciben alertas
- Navegar cuando el usuario toca una notificación

**Ejemplo rápido:**
```typescript
import { alertNotificationService } from '@/services/alert-notification-service';

useEffect(() => {
  if (!systemDetail?.id) return;

  const config: AlertNotificationConfig = {
    systemId: systemDetail.id,
    systemName: systemDetail.name,
    
    onAlertNotificationReceived: (data) => {
      console.log('Nueva alerta:', data);
      // Refrescar, mostrar banner, etc.
    },
    
    onAlertNotificationTapped: (data) => {
      console.log('Usuario tocó:', data);
      // Navegar o mostrar detalles
    },
  };

  alertNotificationService.initialize(config);
  return () => alertNotificationService.destroy();
}, [systemDetail?.id]);
```

### 4. Enviar FCM Token al Backend
**Endpoint que necesitas en tu backend:**
```
POST /api/users/fcm-token
Headers: Authorization: Bearer <token>
Body: {
  "fcmToken": "ExponentPushToken[...]"
}
```

El servicio lo envía automáticamente, pero asegúrate que tu backend lo guarde.

### 5. Backend: Enviar Notificaciones al Crear Alertas
**Cuando se crea una nueva alerta en el backend:**

```javascript
// Node.js con Firebase Admin SDK
const admin = require('firebase-admin');

async function sendAlertNotification(fcmToken, alert) {
  const message = {
    notification: {
      title: `Alerta: ${alert.variableName}`,
      body: `Valor ${alert.value}${alert.unit} está ${
        alert.direction === 'max' ? 'arriba' : 'abajo'
      } del umbral`,
    },
    data: {
      alertId: String(alert.id),
      systemId: String(alert.systemId),
      variableName: alert.variableName,
      value: String(alert.value),
      unit: alert.unit,
      direction: alert.direction,
      timestamp: alert.timestamp.toISOString(),
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'alerts',
      },
    },
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
```

### 6. Construir y Probar en Dispositivo Real
```bash
# Para Android
eas build --platform android --profile preview

# O para desarrollo rápido
expo start --android

# En iOS
eas build --platform ios --profile preview
# O
expo start --ios
```

**Importante:** Las notificaciones solo funcionan en **dispositivos reales**, no en simuladores/emuladores.

### 7. Probar Notificaciones Locales Primero
**Sin necesidad de Firebase, puedes probar localmente:**

```typescript
import { alertNotificationService } from '@/services/alert-notification-service';

// En tu componente, agrega un botón:
<TouchableOpacity
  onPress={async () => {
    await alertNotificationService.sendTestAlertNotification('Humedad');
  }}
>
  <Text>Enviar Notificación de Prueba</Text>
</TouchableOpacity>
```

Esto mostrará una notificación local inmediatamente.

### 8. Probar Desde Firebase Console (Si tienes google-services.json)
```
1. Firebase Console → Engage → Cloud Messaging
2. "Send your first message"
3. Ingresa título y descripción
4. "Send test message"
5. Selecciona el FCM token del usuario
6. Debería aparecer la notificación en el device
```

## 🔍 Checklist de Configuración

- [ ] Firebase Project ID agregado a `app.json`
- [ ] AlertNotificationService integrado en `detailed-system.tsx`
- [ ] Backend endpoint `/users/fcm-token` implementado
- [ ] Backend envía notificaciones via FCM cuando crea alertas
- [ ] Notificaciones locales probadas (con botón de test)
- [ ] App compilada y ejecutada en dispositivo real
- [ ] Notificaciones push recibidas desde Firebase
- [ ] Usuarios navegan correctamente al tocar notificaciones

## 🐛 Troubleshooting

### "Notificaciones no aparecen en dispositivo"
✅ Verifica:
- Dispositivo es real (no simulador)
- App tiene permisos de notificación otorgados
- FCM token está siendo guardado
- Backend está enviando correctamente a FCM

### "FCM token no se obtiene"
✅ Verifica:
- Firebase Project ID es correcto en `app.json`
- `expo-notifications` está instalado
- Necesitas compilar una build nueva: `eas build --platform android`

### "Notificaciones no navegan correctamente"
✅ Verifica:
- `onAlertNotificationTapped` está implementado
- La lógica de navegación es correcta
- El `systemId` en los datos coincide

## 📚 Recursos

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - Setup detallado
- [INTEGRATION_EXAMPLE.md](./INTEGRATION_EXAMPLE.md) - Ejemplos de código

## ⏭️ Próximo Paso Recomendado

1. **Hoy:** Agrega Firebase Project ID a `app.json`
2. **Mañana:** Integra `alertNotificationService` en `detailed-system.tsx`
3. **Luego:** Implementa endpoint de FCM token en backend
4. **Final:** Implementa notificaciones automáticas al crear alertas

## 💬 Notas

- Las notificaciones funcionan automáticamente en foreground y background
- Los tokens pueden cambiar ocasionalmente (el servicio maneja actualización)
- iOS requiere que el usuario acepte el prompt (aparece automáticamente)
- Android 13+ requiere permiso POST_NOTIFICATIONS (solicitado automáticamente)

---

**¿Necesitas ayuda con algún paso?** Puedo ayudarte a:
- Configurar Firebase Project ID
- Implementar AlertNotificationService en tu componente
- Crear el endpoint en tu backend
- Debuggear problemas de notificaciones
