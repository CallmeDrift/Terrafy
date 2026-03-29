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

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    let newErrors: any = {};

    if (!name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }
    if (!email.trim()) {
      newErrors.email = "El correo es obligatorio";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Correo inválido";
    }
    if (!password) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirma tu contraseña";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (validate()) {
      try {
        const response = await fetch("http://192.168.1.8:3000/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name,
            email: email,
            password: password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.log("Error del servidor:", data);
          alert(data.message || "Error al registrarse");
          return;
        }

        console.log("Usuario registrado:", data);
        router.replace("/");
      } catch (error) {
        console.error("Error en la petición:", error);
        alert("No se pudo conectar con el servidor");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Únete a Terrafy</Text>

        {/* Name */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Tu nombre"
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

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
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Crea una contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {errors.password && <Text style={styles.error}>{errors.password}</Text>}

        {/* Confirm Password */}
        <Text style={styles.label}>Confirmar contraseña</Text>
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          placeholder="Repite tu contraseña"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {errors.confirmPassword && (
          <Text style={styles.error}>{errors.confirmPassword}</Text>
        )}

        {/* Button */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
        >
          <Text style={styles.registerText}>Registrarse</Text>
        </TouchableOpacity>

        {/* Go back */}
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Ya tengo cuenta</Text>
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
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  title: {
    fontSize: 26,
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
  inputError: {
    borderWidth: 1,
    borderColor: "red",
  },
  error: {
    color: "red",
    fontSize: 12,
    marginTop: 3,
  },
  registerButton: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  registerText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "bold",
  },
  back: {
    textAlign: "center",
    marginTop: 15,
    color: "#16a34a",
  },
});
