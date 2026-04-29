/**
 * EJEMPLO DE INTEGRACIÓN: Alert Notifications en detailed-system.tsx
 * 
 * Este archivo muestra cómo integrar el servicio de notificaciones de alertas
 * en tu componente de detalles del sistema.
 */

// Agregar estas importaciones al inicio del archivo:
// import { alertNotificationService, AlertNotificationConfig } from '@/services/alert-notification-service';

/**
 * PASO 1: Agregar estado para notificaciones
 */
// En el componente detailed-system.tsx, en la sección de estados:

// const [recentNotification, setRecentNotification] = useState<any>(null);
// const [notificationHistory, setNotificationHistory] = useState<any[]>([]);

/**
 * PASO 2: Inicializar el servicio en useEffect
 */
// Agregar después del useEffect que carga los detalles del sistema:

/*
useEffect(() => {
  if (!systemDetail?.id) return;

  const initializeAlertNotifications = async () => {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) return;

    const config: AlertNotificationConfig = {
      systemId: systemDetail.id,
      systemName: systemDetail.name,
      
      // Callback cuando se recibe una notificación en foreground
      onAlertNotificationReceived: (data) => {
        console.log('🔔 Nueva alerta recibida:', data);
        setRecentNotification(data);
        
        // Agregar a historial
        setNotificationHistory(prev => [
          {
            ...data,
            receivedAt: new Date(),
          },
          ...prev.slice(0, 9) // Mantener últimas 10
        ]);
        
        // Refrescar alertas del sistema
        fetchSystemAlerts({ silent: true });
      },
      
      // Callback cuando el usuario toca una notificación
      onAlertNotificationTapped: (data) => {
        console.log('👆 Usuario tocó alerta:', data);
        
        // Navegar a la variable específica o mostrar detalles
        if (data.variableName) {
          // Scroll to variable or show details
          console.log('Navegar a variable:', data.variableName);
        }
      },
    };

    await alertNotificationService.initialize(config);
  };

  initializeAlertNotifications();

  return () => {
    alertNotificationService.destroy();
  };
}, [systemDetail?.id]);
*/

/**
 * PASO 3: Agregar botón de prueba en la UI
 */
// En la sección de render, puedes agregar un botón para probar:

/*
<TouchableOpacity
  style={styles.testNotificationButton}
  onPress={async () => {
    await alertNotificationService.sendTestAlertNotification('Humedad');
    alert('✅ Notificación de prueba enviada');
  }}
>
  <Text style={styles.buttonText}>Probar Notificación</Text>
</TouchableOpacity>
*/

/**
 * PASO 4: Mostrar notificación reciente en la UI (opcional)
 */
// Si deseas mostrar en la UI que se recibió una notificación:

/*
{recentNotification && (
  <View style={styles.recentNotificationBanner}>
    <Icon name="notifications" size={20} color="#28a745" />
    <View style={{ flex: 1, marginLeft: 10 }}>
      <Text style={styles.notificationTitle}>
        {recentNotification.variableName}
      </Text>
      <Text style={styles.notificationBody}>
        {recentNotification.value}{recentNotification.unit} 
        {' '}por {recentNotification.direction === 'max' ? 'arriba' : 'abajo'} del umbral
      </Text>
    </View>
    <TouchableOpacity onPress={() => setRecentNotification(null)}>
      <Icon name="close" size={20} />
    </TouchableOpacity>
  </View>
)}
*/

/**
 * PASO 5: Enviar FCM token al autenticarse
 */
// En tu archivo de autenticación (donde haces login):

/*
import { alertNotificationService } from '@/services/alert-notification-service';

// Después de autenticar exitosamente:
const handleLoginSuccess = async () => {
  // ... resto del login logic ...
  
  // Enviar FCM token al backend
  await alertNotificationService.refreshFCMToken();
};
*/

/**
 * PASO 6: Refrescar token cuando sea necesario
 */
// En settings o cuando el usuario cierra sesión:

/*
const handleLogout = async () => {
  alertNotificationService.destroy();
  // ... resto del logout logic ...
};
*/

/**
 * EJEMPLO DE INTEGRACIÓN COMPLETA
 */

// En detailed-system.tsx, en el useEffect principal que carga datos:

const exampleCompleteIntegration = `
useEffect(() => {
  // Cargar detalles del sistema
  if (!systemId) return;
  
  const initializeDetailedView = async () => {
    await fetchSystemDetail();
    
    // Inicializar notificaciones si existe el sistema
    if (systemDetail?.id) {
      const config: AlertNotificationConfig = {
        systemId: systemDetail.id,
        systemName: systemDetail.name,
        
        onAlertNotificationReceived: async (data) => {
          console.log('📢 Alert received:', data);
          setRecentNotification(data);
          
          // Refrescar alertas automáticamente
          await fetchSystemAlerts({ silent: true });
          
          // Agregar a historial local
          setNotificationHistory(prev => [
            { ...data, receivedAt: new Date() },
            ...prev.slice(0, 9)
          ]);
        },
        
        onAlertNotificationTapped: (data) => {
          console.log('👆 Tapped:', data);
          // Navigate or show details
        },
      };
      
      await alertNotificationService.initialize(config);
    }
  };
  
  initializeDetailedView();
  
  return () => {
    alertNotificationService.destroy();
  };
}, [systemId, systemDetail?.id]);
`;

/**
 * TESTING
 */

// Para probar en desarrollo:

const testingExample = `
// En tu componente, agrega este botón:

<TouchableOpacity
  onPress={async () => {
    // Simular una alerta
    const testAlert = {
      alertId: \`test-\${Date.now()}\`,
      systemId: systemDetail?.id,
      variableName: 'Humedad',
      value: 75.5,
      unit: '%',
      direction: 'max',
      timestamp: new Date().toISOString(),
    };
    
    // Esto mostrará la notificación localmente
    await alertNotificationService.sendTestAlertNotification('Humedad');
  }}
>
  <Text>🧪 Enviar Alerta de Prueba</Text>
</TouchableOpacity>
`;

/**
 * DIAGRAMA DE FLUJO
 */

const flowDiagram = `
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
│  - Monitorea variables y umbrales                           │
│  - Cuando se crea una alerta, envía a FCM                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ POST a FCM con FCM Token
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            Firebase Cloud Messaging (FCM)                   │
│  - Enruta la notificación al dispositivo del usuario        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Notificación entregada
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   App de Expo                               │
│  - expo-notifications recibe la notificación                │
│  - PushNotificationController la procesa                    │
│  - alertNotificationService maneja callbacks                │
│  - UI se actualiza con alerta nueva                         │
└─────────────────────────────────────────────────────────────┘
`;

console.log('Integration examples loaded');
