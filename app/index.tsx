import { API_URL } from "@/constants/router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<any>({});

  const router = useRouter();

  const validate = () => {
    let newErrors: any = {};

    // Email
    if (!email.trim()) {
      newErrors.email = "El correo es obligatorio";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Correo inválido";
    }

    // Password
    if (!password) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (validate()) {
      try {
        const response = await fetch(
          `${API_URL}/users/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email,
              password: password,
            }),
          },
        );

        const data = await response.json();
        if (!response.ok) {
          console.log("Error del servidor:", data);
          alert(data.message || "Credenciales incorrectas");
          return;
        }
        console.log("Login exitoso:", data);
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        router.replace("/(tabs)/dashboard");
      } catch (error) {
        console.error("Error en la petición:", error);
        alert("No se pudo conectar con el servidor");
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* LOGO */}
        <Image
          source={{ uri: "https://i.ibb.co/XfrJp2yc/chile-morrol.png" }}
          style={styles.logo}
        />

        <Text style={styles.title}>Terrafy</Text>
        <Text style={styles.subtitle}>Monitorea. Analiza. Crece.</Text>

        {/* Email */}
        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="tu.email@ejemplo.com"
          value={email}
          onChangeText={setEmail}
        />
        {errors.email && <Text style={styles.error}>{errors.email}</Text>}

        {/* Password */}
        <Text style={styles.label}>Contraseña</Text>
        <View
          style={[
            styles.passwordContainer,
            errors.password && styles.inputError,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="Ingresa tu contraseña"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>
              {showPassword ? "Ocultar" : "Ver"}
            </Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.error}>{errors.password}</Text>}

        {/* Forgot */}
        <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginText}>Iniciar sesión</Text>
        </TouchableOpacity>

        {/* Divider */}
        <Text style={styles.or}>o</Text>

        {/* Create Account */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/register")}
        >
          <Text style={styles.createText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: "center",
    marginBottom: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#16a34a",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
    color: "#777",
  },
  label: {
    marginTop: 10,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    padding: 12,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
  },
  showText: {
    color: "#16a34a",
    fontWeight: "bold",
  },
  forgot: {
    textAlign: "right",
    color: "#16a34a",
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  loginText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "bold",
  },
  or: {
    textAlign: "center",
    marginVertical: 15,
    color: "#aaa",
  },
  createButton: {
    borderWidth: 1,
    borderColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
  },
  createText: {
    textAlign: "center",
    color: "#16a34a",
    fontWeight: "bold",
  },
  inputError: {
    borderWidth: 1,
    borderColor: "red",
  },

  error: {
    color: "red",
    fontSize: 12,
    marginTop: 3,
  },
});
