// src/screens/payments/AddBalance.js
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator } from "react-native";
import PageLayout from "../../ui/PageLayout";
import { listUserPaymentMethods } from "../../api/paymentMethods";
import { createDepositRequest } from "../../api/deposits";
let DocumentPicker = null;
try {
  DocumentPicker = require("expo-document-picker");
} catch {
  DocumentPicker = null; // نكمل بدون ملفات إذا الحزمة غير مثبتة
}

export default function AddBalance({ navigation, route }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState(null);
  const initialCurrency = (route?.params?.currency || "usd").toLowerCase();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(initialCurrency);

  const [fields, setFields] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await listUserPaymentMethods();
        setMethods(list || []);
        // auto-select من البارامز
        if (route?.params?.methodName && Array.isArray(list)) {
          const init = list.find(
            (m) =>
              (m.name || "").toLowerCase() === route.params.methodName.toLowerCase() ||
              (m.title || "").toLowerCase() === route.params.methodName.toLowerCase()
          );
          if (init) {
            setMethod(init);
            setCurrency((init.currency || "usd").toLowerCase());
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [route?.params?.methodName]);

  const handlePickFile = async (fieldKey) => {
    if (!DocumentPicker) {
      Alert.alert("تنبيه", "expo-document-picker غير مثبت. يمكنك المتابعة بدون ملف.");
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: true });
      if (res?.assets?.[0]) {
        const f = res.assets[0];
        setFields((prev) => ({ ...prev, [fieldKey]: { uri: f.uri, name: f.name } }));
      }
    } catch {}
  };
const handleSubmit = async () => {
  const amt = Number(amount);
  if (!method) return Alert.alert("خطأ", "اختر وسيلة الدفع أولاً.");
  if (!amt || amt <= 0) return Alert.alert("خطأ", "أدخل مبلغًا صحيحًا.");

  try {
    setSending(true);
    const receipt = Object.values(fields).find((value) => value?.uri) || null;
    const extra = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => !value?.uri)
    );

    const { ok, error } = await createDepositRequest({
      amount: amt,
      currency: (currency || "usd").toLowerCase(),
      method: method?.name || "manual",
      payment_method: method?.id,
      extra,
      receipt,
    });

    if (!ok) {
      Alert.alert("خطأ", error || "تعذر إرسال طلب الإيداع.");
      return;
    }

    Alert.alert("تم", "تم إرسال طلب الإيداع للمراجعة ✅");
    navigation.goBack();
  } catch (_e) {
    Alert.alert("خطأ", "تعذر تنفيذ العملية الآن، حاول لاحقاً.");
  } finally {
    setSending(false);
  }
};

  const renderFields = () => {
    if (!method?.fields?.length) return null;
    return method.fields.map((f) => {
      const key = f.field_key;
      if (f.input_type === "file") {
        return (
          <View key={key} style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 6 }}>{f.field_name}</Text>
            <Pressable
              onPress={() => handlePickFile(key)}
              style={{ padding: 12, borderWidth: 1, borderColor: "#E4ECF2", borderRadius: 8 }}
            >
              <Text>{fields[key]?.name || "اختر ملفًا (اختياري)"}</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View key={key} style={{ marginBottom: 10 }}>
          <Text style={{ marginBottom: 6 }}>{f.field_name}</Text>
          <TextInput
            placeholder={f.placeholder || ""}
            value={(fields[key] ?? "").toString()}
            onChangeText={(t) => setFields((prev) => ({ ...prev, [key]: t }))}
            style={{ borderWidth: 1, borderColor: "#E4ECF2", borderRadius: 8, padding: 12 }}
          />
        </View>
      );
    });
  };

  return (
    <PageLayout title="إضافة رصيد">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            {/* اختيار الوسيلة */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 8 }}>وسيلة الدفع</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {methods.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      setMethod(m);
                      setCurrency((m.currency || "usd").toLowerCase());
                    }}
                    style={{
                      padding: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: method?.id === m.id ? "#0B63D8" : "#E4ECF2",
                      marginRight: 10,
                    }}
                  >
                    <Text>{m.title || m.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* المبلغ + العملة */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 6 }}>المبلغ ({currency.toUpperCase()})</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                style={{ borderWidth: 1, borderColor: "#E4ECF2", borderRadius: 8, padding: 12 }}
              />
            </View>

            {/* الحقول الديناميكية */}
            {renderFields()}

            <Pressable
              onPress={handleSubmit}
              disabled={sending}
              style={{
                backgroundColor: sending ? "#9BBBF5" : "#0B63D8",
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {sending ? "جارٍ الإرسال..." : "إرسال طلب الإضافة"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </PageLayout>
  );
}
