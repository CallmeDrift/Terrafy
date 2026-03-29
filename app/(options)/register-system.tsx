import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterSystem() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let newErrors: any = {};

    if (!name.trim()) newErrors.name = "Nombre obligatorio";
    if (!location.trim()) newErrors.location = "Ubicación obligatoria";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

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
        "http://192.168.1.8:3000/api/growing-systems",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user.userId,
            name,
            location,
            description,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Error en la creación");
      }
      console.log("Sistema registrado");
      Alert.alert("Éxito", "Sistema creado correctamente");

      router.back();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar. Intenta nuevamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Registrar sistema</Text>

        {/* Nombre */}
        <Text style={styles.label}>Nombre del sistema</Text>
        <TextInput
          style={[styles.input, errors.name && styles.errorInput]}
          placeholder="Ej: Invernadero A"
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

        {/* Ubicación */}
        <Text style={styles.label}>Ubicación</Text>
        <TextInput
          style={[styles.input, errors.location && styles.errorInput]}
          placeholder="Ej: Zona norte"
          value={location}
          onChangeText={setLocation}
        />
        {errors.location && <Text style={styles.error}>{errors.location}</Text>}

        {/* Descripción */}
        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Descripción del sistema"
          value={description}
          onChangeText={setDescription}
        />

        {/* Botón */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Guardando..." : "Guardar"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#e9f5ec",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#16a34a",
  },
  label: {
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    padding: 12,
  },
  button: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "bold",
  },
  error: {
    color: "red",
    fontSize: 12,
  },
  errorInput: {
    borderWidth: 1,
    borderColor: "red",
  },
});
