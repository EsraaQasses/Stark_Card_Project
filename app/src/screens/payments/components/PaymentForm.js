// src/screens/payments/components/PaymentForm.js
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, I18nManager } from "react-native";
 
const isRTL = I18nManager.isRTL !== false; // اعتبر RTL افتراضي حالياً

export default function PaymentForm({
  navigation,
  product,                       // { id, title, price_usd, price_syp, options?[] }
  currency = "USD",              // "USD" | "SYP"
  getExchangeRate,               // من الـ CurrencyProvider
  method,                        // الوسيلة المختارة (قد تكون null بالبداية)
  setMethod,                     // setter خارجي
  onPickMethod,                  // يفتح قائمة الوسائل
  onSubmit,                      // ({ quantity, selected_options, method_fields }) => void
}) {
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [methodFields, setMethodFields] = useState({});

  const rate = getExchangeRate?.() || { usd_to_syp: 1 };
  const usd2syp = Number(rate.usd_to_syp || 1);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const cur = (currency || "USD").toUpperCase();
    if (cur === "USD") {
      return (product.price_usd != null)
        ? Number(product.price_usd)
        : (product.price_syp != null ? Number(product.price_syp) / (usd2syp || 1) : 0);
    } else {
      return (product.price_syp != null)
        ? Number(product.price_syp)
        : (product.price_usd != null ? Number(product.price_usd) * (usd2syp || 1) : 0);
    }
  }, [product, currency, usd2syp]);

  const total = useMemo(() => Number(unitPrice) * Number(qty || 1), [unitPrice, qty]);

  const setOpt = (key, value) => setSelectedOptions(prev => ({ ...prev, [key]: value }));

  const dec = () => setQty(q => Math.max(1, Number(q) - 1));
  const inc = () => setQty(q => Number(q) + 1);

  const validateAndSubmit = () => {
    if (!method?.id) {
      alert("اختر وسيلة دفع أولاً.");
      return;
    }
    // تأكد من الحقول المطلوبة ضمن الوسيلة:
    const required = (method?.fields || []).filter(f => f.is_required);
    for (const f of required) {
      const v = methodFields[f.field_key];
      if (v == null || String(v).trim() === "") {
        alert(`يرجى تعبئة الحقل: ${f.field_name}`);
        return;
      }
    }
    onSubmit?.({
      quantity: qty,
      selected_options: selectedOptions,
      method_fields: methodFields,
    });
  };

  return (
    <View style={{ gap: 12 }}>
      {/* بطاقة المنتج (إن وُجد) */}
      {product && (
        <View style={styles.card}>
          <Text style={[styles.title, styles.rtlText]}>{product.title || "منتج"}</Text>
          <Text style={[styles.price, styles.rtlText]}>
            {Number(unitPrice).toLocaleString()} {currency}
          </Text>

          {/* كمية */}
          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.label, styles.rtlText]}>الكمية</Text>
            <View style={[styles.qtyBox, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable
                onPress={dec}
                style={[
                  styles.qtyBtn,
                  isRTL
                    ? { borderTopRightRadius: 10, borderBottomRightRadius: 10 }
                    : { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                ]}
              >
                <Text style={styles.rtlText}>-</Text>
              </Pressable>
              <View style={styles.qtyMid}><Text style={{ fontWeight: "800" }}>{qty}</Text></View>
              <Pressable
                onPress={inc}
                style={[
                  styles.qtyBtn,
                  isRTL
                    ? { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }
                    : { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
                ]}
              >
                <Text style={styles.rtlText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* خيارات مخصصة (إن وُجدت) */}
          {Array.isArray(product?.options) && product.options.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.label, styles.rtlText]}>الخيارات</Text>
              {product.options.map((opt) => (
                <View key={opt.key || opt.name} style={{ marginTop: 6 }}>
                  <Text style={[styles.subLabel, styles.rtlText]}>{opt.title || opt.name}</Text>
                  {Array.isArray(opt.choices) ? (
                    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {opt.choices.map((val) => {
                        const active = selectedOptions[opt.key] === val;
                        return (
                          <Pressable
                            key={String(val)}
                            onPress={() => setOpt(opt.key, val)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[{ fontWeight: "700" }, styles.rtlText]}>{String(val)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      placeholder={opt.placeholder || ""}
                      onChangeText={(v) => setOpt(opt.key, v)}
                      style={[styles.input, styles.inputRTL]}
                      textAlign="right"
                      placeholderTextColor="#8AA0B5"
                    />
                  )}
                </View>
              ))}
            </View>
          )}

          {/* الإجمالي */}
          <View style={[styles.totalRow]}>
            <Text style={[styles.subLabel, styles.rtlText, { opacity: 0.7 }]}>الإجمالي</Text>
            <Text style={[styles.price, { fontSize: 18 }]}>
              {Number(total).toLocaleString()} {currency}
            </Text>
          </View>
        </View>
      )}

      {/* وسيلة الدفع */}
      <View style={styles.card}>
        <Text style={[styles.title, styles.rtlText]}>وسيلة الدفع</Text>

        {method ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.subLabel, styles.rtlText]}>
              {method.title || method.name}
            </Text>

            {/* حقول الوسيلة */}
            {(method.fields || []).map((f) => (
              <View key={f.id || f.field_key} style={{ marginTop: 8 }}>
                <Text style={[styles.subLabel, styles.rtlText]}>
                  {f.field_name}{f.is_required ? " *" : ""}
                </Text>
                <TextInput
                  placeholder={f.placeholder || ""}
                  keyboardType={
                    f.input_type === "number" ? "numeric" :
                    f.input_type === "email"  ? "email-address" : "default"
                  }
                  onChangeText={(v) => setMethodFields(prev => ({ ...prev, [f.field_key]: v }))}
                  style={[styles.input, styles.inputRTL]}
                  textAlign="right"
                  placeholderTextColor="#8AA0B5"
                />
              </View>
            ))}

            {!!method.instructions && (
              <Text style={[{ marginTop: 6, opacity: 0.7 }, styles.rtlText]}>{method.instructions}</Text>
            )}

            <Pressable onPress={onPickMethod} style={[styles.btn, { backgroundColor: "#eef2ff", marginTop: 12 }]}>
              <Text style={[styles.btnText, { color: "#1d4ed8" }]}>تغيير وسيلة الدفع</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onPickMethod} style={[styles.btn, { marginTop: 8 }]}>
            <Text style={styles.btnText}>اختيار وسيلة دفع</Text>
          </Pressable>
        )}
      </View>

      {/* زر الدفع */}
      <Pressable onPress={validateAndSubmit} style={[styles.btn, { backgroundColor: "#1274f5ff" }]}>
        <Text style={[styles.btnText, { color: "#fff" }]}>ادفع الآن</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    borderRadius: 16,
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0E1B3B",
  },
  price: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: "#0E1B3B",
    textAlign: "right",
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0E1B3B",
    marginLeft: 8,  // نعكس الهامش لأن النص يمين
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0E1B3B",
  },
  // صف عام يدعم RTL
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  // صف الإجمالي يمين-يسار مع RTL
  totalRow: {
    marginTop: 10,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyBox: {
    marginRight: 10, // بديل عن marginLeft لأننا RTL
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
  },
  qtyBtn: {
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyMid: {
    paddingHorizontal: 14,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: "rgba(18,116,245,0.10)",
    borderColor: "#1274f5",
  },
  input: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  inputRTL: {
    textAlign: "right",
  },
  btn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1274f5",
  },
  btnText: {
    fontWeight: "900",
    color: "#0E1B3B",
  },
  rtlText: {
    textAlign: "right",
  },
});
