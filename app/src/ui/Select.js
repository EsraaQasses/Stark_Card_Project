import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
// If you already use Expo, this works. Otherwise remove Ionicons and the icon usage below.
import { Ionicons } from "@expo/vector-icons";

export default function Select({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  return (
    <View>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.9}>
        <View style={styles.field}>
          <Text style={styles.valueText}>{selected?.label ?? "Select"}</Text>
          {/* If you don’t have Ionicons, replace the next line with: <Text>▼</Text> */}
          <Ionicons name="chevron-down" size={18} color="#001433" />
        </View>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#fff", marginLeft: 6, marginBottom: 6, fontWeight: "700" },
  field: {
    height: 46,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#001842",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  valueText: { color: "#001433", fontSize: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 22,
  },
  sheet: { backgroundColor: "#fff", borderRadius: 16, padding: 14, maxHeight: "60%" },
  option: { padding: 14, borderRadius: 12, backgroundColor: "#F4F6FB" },
  optionText: { fontWeight: "600", color: "#001433" },
});
