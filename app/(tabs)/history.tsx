import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function History() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const fetchSystems = async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");
      const userString = await AsyncStorage.getItem("user");

      if (!token || !userString) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      const user = JSON.parse(userString);

      const response = await fetch(
        `${API_URL}/growing-systems/${user.userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Error al obtener datos");
      }

      const result = await response.json();
      console.log("Sistemas obtenidos:", result);

      setData(result.systems);
    } catch (error) {
      Alert.alert("Error", "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 CONFIRMACIÓN MULTIPLATAFORMA
  const confirmDelete = async () => {
    if (Platform.OS === "web") {
      return confirm("¿Estás seguro de eliminar este sistema?");
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        "Eliminar sistema",
        "¿Estás seguro de eliminar este sistema?",
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

  const handleDeleteSystem = async (systemId: number) => {
    console.log("CLICK DELETE SYSTEM");

    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      console.log("DELETE SYSTEM ID:", systemId);

      const response = await fetch(`${API_URL}/growing-systems/${systemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("STATUS:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("ERROR:", errorText);

        Alert.alert("Error", "No se pudo eliminar el sistema");
        return;
      }

      Alert.alert("Éxito", "Sistema eliminado");

      fetchSystems();
    } catch (error) {
      console.error("Error deleting system:", error);
      Alert.alert("Error", "Ocurrió un error inesperado");
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSystems();
    }, []),
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Historial</Text>
      <Text style={styles.subtitle}>Sistemas de cultivo</Text>

      {loading && <ActivityIndicator size="large" />}

      {!loading && data.length === 0 && (
        <Text style={{ textAlign: "center", marginTop: 20 }}>
          No hay sistemas registrados
        </Text>
      )}

      {data.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <View key={item.systemId} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="leaf-outline" size={18} color="#16a34a" />
                </View>

                <View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(options)/detailed-system",
                        params: { systemId: String(item.systemId) },
                      })
                    }
                  >
                    <Text style={styles.zone}>{item.name}</Text>
                  </TouchableOpacity>
                  <Text style={styles.date}>
                    {new Date(item.creationDate).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* EDITAR */}
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(options)/edit-system",
                      params: {
                        systemId: item.systemId,
                        name: item.name,
                        location: item.ubication,
                        description: item.description || "",
                      },
                    })
                  }
                >
                  <Ionicons name="pencil" size={20} color="#16a34a" />
                </TouchableOpacity>

                {/* ELIMINAR */}
                <TouchableOpacity
                  onPress={() => handleDeleteSystem(item.systemId)}
                >
                  <Ionicons name="trash-outline" size={20} color="red" />
                </TouchableOpacity>

                {/* EXPANDIR */}
                <TouchableOpacity onPress={() => toggle(index)}>
                  <Ionicons
                    name={isOpen ? "remove" : "add"}
                    size={20}
                    color="#16a34a"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isOpen ? (
              <View style={styles.details}>
                <View style={styles.row}>
                  <Text>Ubicación</Text>
                  <Text style={styles.value}>{item.ubication}</Text>
                </View>

                <View style={styles.row}>
                  <Text>Descripción</Text>
                  <Text style={styles.value}>
                    {item.description || "Sin descripción"}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text>Estado</Text>
                  <Text style={styles.value}>{item.status}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.miniRow}>
                <Text>{item.ubication}</Text>
                <Text>{item.status}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
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
  subtitle: {
    color: "#666",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    backgroundColor: "#dcfce7",
    padding: 8,
    borderRadius: 10,
  },

  zone: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#166534",
    textDecorationLine: "underline",
  },
  date: {
    color: "#888",
    fontSize: 12,
  },

  details: {
    marginTop: 15,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  value: {
    fontWeight: "bold",
    color: "#16a34a",
  },

  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
});
