import Picker, { PickerOption } from "@/components/picker";
import { API_URL } from "@/constants/router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterVariable() {
  type GrowingSystem = {
    systemId: number;
    name: string;
    ubication?: string;
  };

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");

  const [systems, setSystems] = useState<GrowingSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const showToast = (message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert("Información", message);
  };

  // 🔥 Traer sistemas
  const fetchSystems = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userString = await AsyncStorage.getItem("user");

      if (!token || !userString) return;

      const user = JSON.parse(userString);

      const response = await fetch(
        `${API_URL}/growing-systems/${user.userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      setSystems(result.systems || []);
    } catch (error) {
      Alert.alert("Error", "No se pudieron cargar los sistemas");
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  const systemOptions: PickerOption<number>[] = systems.map((sys) => ({
    value: sys.systemId,
    label: sys.name,
    description: sys.ubication,
  }));

  const validate = () => {
    let newErrors: any = {};

    if (!name.trim()) newErrors.name = "Nombre requerido";
    if (!unit.trim()) newErrors.unit = "Unidad requerida";
    if (!selectedSystemId)
      newErrors.system = "Debes seleccionar un sistema";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      const registerVariableEndpoint = `${API_URL}/agronomic-variables`;
      const payload = {
        name: name.trim(),
        measurementUnit: unit.trim(),
        description: description.trim(),
      };

      const tryParseJson = async (response: Response) => {
        try {
          return await response.json();
        } catch {
          return null;
        }
      };

      const getVariableId = (data: any) =>
        data?.variableId ??
        data?.id ??
        data?.variable?.variableId ??
        data?.variable?.id ??
        null;

      const createResponse = await fetch(
        registerVariableEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      let variableId: number | null = null;

      if (createResponse.ok) {
        const variable = await tryParseJson(createResponse);
        variableId = getVariableId(variable);
      } else if (createResponse.status === 409) {
        showToast("La variable ya existe");
        const conflictBody = await tryParseJson(createResponse);
        variableId = getVariableId(conflictBody);

        if (!variableId) {
          showToast("Ya existe una variable con ese nombre");
          return;
        }
      } else {
        const errorBody = await tryParseJson(createResponse);
        const message = errorBody?.message || "Error al crear variable";
        throw new Error(message);
      }

      if (!variableId) {
        throw new Error("No se recibió el identificador de la variable");
      }

      const associateResponse = await fetch(
        `${API_URL}/growing-systems/${selectedSystemId}/variable/${variableId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sampleRate: 60,
          }),
        }
      );

      if (!associateResponse.ok) {
        if (associateResponse.status === 409) {
          showToast("La variable ya estaba asociada a este sistema");
          return;
        }

        const associateBody = await tryParseJson(associateResponse);
        const message = associateBody?.message || "Error al asociar variable";
        throw new Error(message);
      }

      Alert.alert("Éxito", "Variable registrada correctamente");

      setName("");
      setUnit("");
      setDescription("");
      setSelectedSystemId(null);

    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la variable";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Registrar variable</Text>

        {/* Name */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={[styles.input, errors.name && styles.errorInput]}
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

        {/* Unit */}
        <Text style={styles.label}>Unidad</Text>
        <TextInput
          style={[styles.input, errors.unit && styles.errorInput]}
          value={unit}
          onChangeText={setUnit}
        />
        {errors.unit && <Text style={styles.error}>{errors.unit}</Text>}

        {/* Description */}
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
        />
        <Text style={styles.label}>Seleccionar sistema</Text>
        <Picker
          value={selectedSystemId}
          options={systemOptions}
          onChange={setSelectedSystemId}
          placeholder="Elige un sistema de cultivo"
          error={errors.system}
          disabled={systems.length === 0}
        />

        {/* Button */}
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
  systemItem: {
    backgroundColor: "#f2f2f2",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },

  systemSelected: {
    borderWidth: 2,
    borderColor: "#16a34a",
  },
});
