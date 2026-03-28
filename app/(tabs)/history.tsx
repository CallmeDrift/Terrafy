import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
        `http://192.168.1.13:3000/api/growing-systems/${user.userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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

  useFocusEffect(
    useCallback(() => {
      fetchSystems();
    }, [])
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
            <TouchableOpacity
              style={styles.header}
              onPress={() => toggle(index)}
            >
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="leaf-outline"
                    size={18}
                    color="#16a34a"
                  />
                </View>

                <View>
                  <Text style={styles.zone}>{item.name}</Text>
                  <Text style={styles.date}>
                    {new Date(item.creationDate).toLocaleString()}
                  </Text>
                </View>
              </View>

              <Ionicons
                name={isOpen ? "remove" : "add"}
                size={20}
                color="#16a34a"
              />
            </TouchableOpacity>

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