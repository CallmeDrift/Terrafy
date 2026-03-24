import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function NewData() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      
      <Text style={styles.title}>Nuevo registro</Text>
      <Text style={styles.subtitle}>
        Selecciona el tipo de información que deseas registrar
      </Text>

      {/* Button A*/}
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/(options)/register-system")}
      >
        <View style={styles.row}>
          <Ionicons name="leaf-outline" size={24} color="#16a34a" />
          <Text style={styles.cardText}>Registrar sistema de cultivo</Text>
        </View>
      </TouchableOpacity>

      {/* Button B*/}
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/(options)/register-variable")}
      >
        <View style={styles.row}>
          <Ionicons name="flask-outline" size={24} color="#16a34a" />
          <Text style={styles.cardText}>Registrar variables agronómicas</Text>
        </View>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    color: "#666",
    marginBottom: 25,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
