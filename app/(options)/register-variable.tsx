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
export default function RegisterVariable() {
  const router = useRouter();

  const [ph, setPh] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [oxygen, setOxygen] = useState("");

  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    let newErrors: any = {};

    if (!ph) newErrors.ph = "Requerido";
    if (!temperature) newErrors.temperature = "Requerido";
    if (!humidity) newErrors.humidity = "Requerido";
    if (!oxygen) newErrors.oxygen = "Requerido";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      console.log("Variables guardadas");
      router.back();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        
        <Text style={styles.title}>Registrar variables</Text>

        {/* pH */}
        <Text style={styles.label}>pH</Text>
        <TextInput
          style={[styles.input, errors.ph && styles.errorInput]}
          keyboardType="numeric"
          value={ph}
          onChangeText={setPh}
        />
        {errors.ph && <Text style={styles.error}>{errors.ph}</Text>}

        {/* Temperatura */}
        <Text style={styles.label}>Temperatura (°C)</Text>
        <TextInput
          style={[styles.input, errors.temperature && styles.errorInput]}
          keyboardType="numeric"
          value={temperature}
          onChangeText={setTemperature}
        />
        {errors.temperature && <Text style={styles.error}>{errors.temperature}</Text>}

        {/* Humedad */}
        <Text style={styles.label}>Humedad (%)</Text>
        <TextInput
          style={[styles.input, errors.humidity && styles.errorInput]}
          keyboardType="numeric"
          value={humidity}
          onChangeText={setHumidity}
        />
        {errors.humidity && <Text style={styles.error}>{errors.humidity}</Text>}

        {/* Oxígeno */}
        <Text style={styles.label}>Oxígeno (%)</Text>
        <TextInput
          style={[styles.input, errors.oxygen && styles.errorInput]}
          keyboardType="numeric"
          value={oxygen}
          onChangeText={setOxygen}
        />
        {errors.oxygen && <Text style={styles.error}>{errors.oxygen}</Text>}

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
