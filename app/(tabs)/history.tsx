import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function History() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const data = [
    {
      zone: "Zone B3",
      date: "2026-02-21 at 14:30",
      ph: "6.8 pH",
      temp: "24 °C",
      oxygen: "20.9 %",
      humidity: "65 %",
    },
    {
      zone: "Zone A1",
      date: "2026-02-21 at 09:15",
      ph: "7.1",
      temp: "22",
      oxygen: "21",
      humidity: "72",
    },
    {
      zone: "Zone B3",
      date: "2026-02-20 at 16:45",
      ph: "6.9",
      temp: "26",
      oxygen: "20.8",
      humidity: "58",
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Historial</Text>
      <Text style={styles.subtitle}>Ver mediciones pasadas</Text>

      {data.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <View key={index} style={styles.card}>
            
            <TouchableOpacity
              style={styles.header}
              onPress={() => toggle(index)}
            >
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="calendar-outline" size={18} color="#16a34a" />
                </View>

                <View>
                  <Text style={styles.zone}>{item.zone}</Text>
                  <Text style={styles.date}>{item.date}</Text>
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
                  <View style={styles.rowLeft}>
                    <Ionicons name="flask-outline" size={16} color="#16a34a" />
                    <Text>pH del suelo</Text>
                  </View>
                  <Text style={styles.value}>{item.ph}</Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="thermometer-outline" size={16} color="#f97316" />
                    <Text>Temperatura del suelo</Text>
                  </View>
                  <Text style={styles.value}>{item.temp}</Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="leaf-outline" size={16} color="#3b82f6" />
                    <Text>Oxígeno en el aire</Text>
                  </View>
                  <Text style={styles.value}>{item.oxygen}</Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="water-outline" size={16} color="#06b6d4" />
                    <Text>Humedad</Text>
                  </View>
                  <Text style={styles.value}>{item.humidity}</Text>
                </View>

              </View>
            ) : (
              <View style={styles.miniRow}>
                <Text>{item.ph}</Text>
                <Text>{item.temp}</Text>
                <Text>{item.oxygen}</Text>
                <Text>{item.humidity}</Text>
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
    alignItems: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: {
    fontWeight: "bold",
    color: "#16a34a",
  },

  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    color: "#999",
  },
});
