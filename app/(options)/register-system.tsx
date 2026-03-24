import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// me dio pereza revisar esto, mañana veo que hizo el chismoso jeje
export default function RegisterSystem() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    let newErrors: any = {};

    if (!name.trim()) newErrors.name = "Nombre obligatorio";
    if (!location.trim()) newErrors.location = "Ubicación obligatoria";
    if (!type.trim()) newErrors.type = "Tipo obligatorio";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      console.log("Sistema registrado");
      router.back();
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

        {/* Tipo */}
        <Text style={styles.label}>Tipo de cultivo</Text>
        <TextInput
          style={[styles.input, errors.type && styles.errorInput]}
          placeholder="Ej: Hidropónico"
          value={type}
          onChangeText={setType}
        />
        {errors.type && <Text style={styles.error}>{errors.type}</Text>}

        {/* Botón */}
        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Guardar</Text>
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
