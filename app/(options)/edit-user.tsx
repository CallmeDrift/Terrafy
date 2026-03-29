import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function EditUser() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    const loadUser = async () => {
      const user = await AsyncStorage.getItem("user");

      if (user) {
        const parsed = JSON.parse(user);
        setName(parsed.name);
        setEmail(parsed.email);
      }
    };

    loadUser();
  }, []);

  const validate = () => {
    let newErrors: any = {};

    if (!name.trim()) newErrors.name = "Nombre obligatorio";

    if (!email.trim()) {
      newErrors.email = "Correo obligatorio";
    } else if (!email.includes("@")) {
      newErrors.email = "Correo inválido";
    }

    if (password && password.length < 8) {
      newErrors.password = "Mínimo 8 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleUpdate = async () => {
    if (!validate()) return;

    try {
      const userStored = await AsyncStorage.getItem("user");
      const token = await AsyncStorage.getItem("token");

      if (!userStored || !token) {
        alert("Not valid session");
        return;
      }

      const user = JSON.parse(userStored);

      const response = await fetch(
        `http://192.168.1.8:3000/api/users/${user.userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            email,
            ...(password && { password }),
          }),
        },
      );

      console.log("User data to update:", {
        user: user.id,
        name,
        email,
        password,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Error al actualizar");
        return;
      }
      const updatedUser = { ...user, ...data };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

      alert("Perfil actualizado");
      router.back();
      // MI LOCO, CAMBIA LA ALERTA POR UN TOAST
      //PQ YO?? PQ LUIS SIGUE SIN CHAMBEAR UN CARAJO
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Editar perfil</Text>

        {/* Name */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={[styles.input, errors.name && styles.errorInput]}
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

        {/* Email */}
        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={[styles.input, errors.email && styles.errorInput]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        {errors.email && <Text style={styles.error}>{errors.email}</Text>}

        {/* Password */}
        <Text style={styles.label}>Nueva contraseña</Text>
        <TextInput
          style={[styles.input, errors.password && styles.errorInput]}
          placeholder="Opcional"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {errors.password && <Text style={styles.error}>{errors.password}</Text>}

        {/* Button */}
        <TouchableOpacity style={styles.button} onPress={handleUpdate}>
          <Text style={styles.buttonText}>Guardar cambios</Text>
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
