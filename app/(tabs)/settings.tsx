import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");

      router.replace("/");
    } catch (error) {
      console.error("Error closing session:", error);
    }
  };

  const confirmDelete = async () => {
    if (Platform.OS === "web") {
      return confirm(
        "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.",
      );
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        "Eliminar cuenta",
        "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.",
        [
          {
            text: "Cancelar",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
      );
    });
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      const rawToken = await AsyncStorage.getItem("token");
      const token = rawToken ? rawToken.replace(/"/g, "") : null;

      const userId = user?.userId;

      console.log("USER:", user);
      console.log("USER ID:", userId);
      console.log("TOKEN:", token);

      if (!userId || !token) {
        Alert.alert("Error", "No se pudo obtener el usuario o el token");
        return;
      }

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("STATUS:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("ERROR:", errorText);

        Alert.alert("Error", "No se pudo eliminar la cuenta");
        return;
      }

      Alert.alert("Éxito", "Cuenta eliminada correctamente");

      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");

      router.replace("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      Alert.alert("Error", "Ocurrió un error inesperado");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuraciones</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={{ color: "#fff", fontSize: 20 }}>👤</Text>
        </View>

        <View>
          <Text style={styles.name}>{user?.name || "Usuario"}</Text>
          <Text style={styles.email}>
            {user?.email || "correo@ejemplo.com"}
          </Text>

          <TouchableOpacity
            onPress={() => router.push("../(options)/edit-user")}
          >
            <Text style={styles.edit}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>cuenta</Text>

        <TouchableOpacity style={styles.option}>
          <View style={styles.optionLeft}>
            <Ionicons name="person-outline" size={20} color="#333" />
            <Text style={styles.optionText}>Información Personal</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.option}>
          <View style={styles.optionLeft}>
            <Ionicons name="notifications-outline" size={20} color="#333" />
            <Text style={styles.optionText}>Notificaciones</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.option}>
          <View style={styles.optionLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#333" />
            <Text style={styles.optionText}>Privacidad y Seguridad</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferencias</Text>

        <TouchableOpacity style={styles.option} onPress={handleDeleteAccount}>
          <View style={styles.optionLeft}>
            <Ionicons name="trash-outline" size={20} color="red" />
            <Text style={[styles.optionText, { color: "red" }]}>
              Eliminar cuenta
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={{ color: "red", fontWeight: "bold" }}>Salir</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
    padding: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  profileCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  name: {
    fontWeight: "bold",
  },
  email: {
    color: "#666",
  },
  edit: {
    color: "#16a34a",
    marginTop: 5,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    marginBottom: 15,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    marginLeft: 10,
  },
  logout: {
    borderWidth: 1,
    borderColor: "red",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
  },
});
