// src/screens/SignUp/ResetPassword.js

import React, { useEffect, useState } from "react";
import {
  Alert,
  View,
  Image,
  Text,
  TextInput,
  StyleSheet,
  Keyboard,
} from "react-native";

import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";
import { resetPassword } from "../../api/auth";

import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthProvider";

const { colors: themeColors, typography } = theme;

function firstParam(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value == null ? "" : String(value);
}

export default function ResetPassword({ navigation, route }) {
  const router = useRouter();
  const { signOut } = useAuth();

  const routeToken = firstParam(route?.params?.token);

  const [token, setToken] = useState(routeToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errBanner, setErrBanner] = useState([]);

  useEffect(() => {
    setToken(routeToken);
  }, [routeToken]);

  const tokenTrim = token.trim();
  const hasRouteToken = routeToken.trim().length > 0;

  /*
   * لا نتحقق هنا من:
   * - طول كلمة المرور
   * - وجود أحرف كبيرة/صغيرة
   * - أرقام
   * - رموز
   * - تطابق كلمة المرور
   *
   * كل قواعد كلمة المرور يتم التحقق منها في الـ Backend.
   *
   * الواجهة فقط تتأكد أن البيانات المطلوبة موجودة.
   */
  const canSubmit =
    tokenTrim.length > 0 &&
    password.length > 0 &&
    confirm.length > 0;

  const onSubmit = async () => {
    if (!canSubmit || loading) {
      return;
    }

    Keyboard.dismiss();
    setErrBanner([]);

    try {
      setLoading(true);

      await resetPassword({
        reset_token: tokenTrim,
        new_password: password,
        confirm_password: confirm,
      });

      // حذف البيانات الحساسة من الذاكرة بعد نجاح العملية
      setToken("");
      setPassword("");
      setConfirm("");

      // تنظيف أي جلسة قديمة
      await signOut();

      Alert.alert(
        "تمت العملية بنجاح",
        "تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن",
        [
          {
            text: "تسجيل الدخول",
            onPress: () => {
              router.replace({
                pathname: "/(auth)/login",
                params: {
                  successMessage:
                    "تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن",
                },
              });
            },
          },
        ]
      );
    } catch (err) {
      const data = err?.response?.data;

      let errorMsg =
        data?.message?.ar ||
        data?.message?.en ||
        data?.detail ||
        data?.error ||
        "تعذر تغيير كلمة المرور. يرجى التحقق والمحاولة مرة أخرى.";

      /*
       * إذا أعاد الـ Backend تفاصيل قواعد كلمة المرور،
       * نعرضها للمستخدم بدون تنفيذ القواعد في الـ Frontend.
       */
      if (
        data?.code === "PASSWORD_RESET_PASSWORD_POLICY" &&
        Array.isArray(data?.details?.errors)
      ) {
        const policyErrors = data.details.errors
          .map((error) => `- ${error}`)
          .join("\n");

        errorMsg = `${errorMsg}\n${policyErrors}`;
      }

      setErrBanner([String(errorMsg)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Image
          source={require("../../assets/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {errBanner.length > 0 && (
        <View style={styles.errorBanner}>
          {errBanner.map((message, index) => (
            <Text key={index} style={styles.errorBannerText}>
              {message}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.title}>إعادة تعيين كلمة المرور</Text>

        {!hasRouteToken && (
          <>
            <Text style={styles.label}>رمز إعادة التعيين (Token)</Text>

            <TextInput
              style={styles.input}
              placeholder="الصق الرمز المستلم"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
          </>
        )}

        <Text style={styles.label}>كلمة المرور الجديدة</Text>

        <TextInput
          style={styles.input}
          placeholder="أدخل كلمة المرور الجديدة"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />

        <Text style={styles.label}>تأكيد كلمة المرور</Text>

        <TextInput
          style={styles.input}
          placeholder="أعد إدخال كلمة المرور الجديدة"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
        />

        <Button
          variant="auth"
          title={loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
          width={sx(200)}
          height={sy(52)}
          onPress={onSubmit}
          disabled={!canSubmit || loading}
          style={{
            marginTop: sy(22),
            alignSelf: "center",
            opacity: canSubmit && !loading ? 1 : 0.6,
          }}
        />
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.bottomRow}>
          <View style={styles.line} />

          <Text style={styles.muted}>
            تذكرت كلمة المرور؟
          </Text>

          <View style={styles.line} />
        </View>

        <Text
          style={styles.link}
          onPress={() => router.replace("/(auth)/login")}
        >
          تسجيل الدخول
        </Text>
      </View>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginTop: sy(6),
    marginBottom: sy(2),
  },

  logo: {
    width: sx(370),
    height: sy(250),
  },

  errorBanner: {
    marginHorizontal: sx(16),
    marginTop: sy(6),
    paddingVertical: sy(10),
    paddingHorizontal: sx(12),
    backgroundColor: "#FFE8E8",
    borderLeftWidth: 4,
    borderLeftColor: "tomato",
    borderRadius: sy(10),
  },

  errorBannerText: {
    color: "#9b1c1c",
    fontWeight: "800",
    fontSize: sp(12),
    marginBottom: sy(2),
    textAlign: "right",
  },

  form: {
    flex: 1,
    marginTop: sy(8),
    paddingHorizontal: sx(2),
  },

  title: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    fontSize: sp(22),
    marginBottom: sy(12),
    textAlign: "center",
  },

  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(8),
    fontWeight: "600",
    fontSize: sp(14),
    textAlign: "right",
  },

  input: {
    height: sy(46),
    borderRadius: sy(23),
    paddingHorizontal: sx(16),
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    marginBottom: sy(12),
    fontSize: sp(14),
  },

  bottomBlock: {
    alignItems: "center",
    marginBottom: sy(6),
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: sy(4),
    gap: sx(8),
  },

  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  muted: {
    color: themeColors.textMuted,
    fontWeight: "600",
    fontSize: sp(12),
  },

  link: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    marginTop: sy(4),
    textAlign: "center",
    fontSize: sp(14),
  },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: typography.footer.fontSize,
  },
});