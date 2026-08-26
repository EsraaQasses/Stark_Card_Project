// src/screens/SignUp/ForgetPassword.js
import React, { useState, useEffect } from "react";
import { View, Image, Text, TextInput, StyleSheet, Keyboard, TouchableOpacity } from "react-native";
import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";
import {
  requestPasswordReset,
  resendPasswordResetCode,
  verifyPasswordResetCode,
} from "../../api/auth";

const { colors: themeColors, typography } = theme;

export default function ForgetPassword({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errBanner, setErrBanner] = useState([]);
  const [infoBanner, setInfoBanner] = useState([]);
  
  // Flow steps management
  const [requestId, setRequestId] = useState(null); // holds the request_id when OTP is requested
  const [code, setCode] = useState(""); // holds the 6-digit OTP code input
  const [cooldown, setCooldown] = useState(0); // resend cooldown timer

  const emailTrim = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
  const canSend = validEmail;

  // Handle countdown cooldown timer
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Phase 1: Request Password Reset OTP
  const onSend = async () => {
    if (!canSend || loading) return;
    Keyboard.dismiss();
    setErrBanner([]);
    setInfoBanner([]);

    try {
      setLoading(true);
      const response = await requestPasswordReset(emailTrim);
      if (response?.request_id) {
        setRequestId(response.request_id);
      }
      
      // Start cooldown timer based on backend response (resend_after) or default to 60s
      const resendAfter = response?.resend_after ?? 60;
      setCooldown(resendAfter);

      setInfoBanner([
        response?.message?.ar || 
        response?.message?.en || 
        "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال رمز التحقق."
      ]);
    } catch (err) {
      const resp = err?.response;
      const data = resp?.data;
      const msg =
        data?.message?.ar ||
        data?.message?.en ||
        data?.detail ||
        data?.error ||
        "تعذر إرسال رمز التحقق. حاول مرة أخرى.";
      setErrBanner([String(msg)]);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Verify OTP and navigate to Reset Password with token
  const onVerify = async () => {
    if (!requestId || code.trim().length !== 6 || loading) return;
    Keyboard.dismiss();
    setErrBanner([]);
    setInfoBanner([]);

    try {
      setLoading(true);
      const response = await verifyPasswordResetCode({
        request_id: requestId,
        code: code.trim(),
      });

      const token = response?.reset_token;
      if (!token) {
        throw new Error("لم يتم استلام رمز إعادة التعيين من الخادم.");
      }

      // Reset local screen states
      setCode("");
      
      // Navigate to ResetPassword and pass the reset_token
      navigation.replace("ResetPassword", { token });
    } catch (err) {
      const resp = err?.response;
      const data = resp?.data;
      const msg =
        data?.message?.ar ||
        data?.message?.en ||
        data?.detail ||
        data?.error ||
        "رمز التحقق غير صالح أو منتهي الصلاحية.";
      setErrBanner([String(msg)]);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const onResend = async () => {
    if (!requestId || cooldown > 0 || loading) return;
    Keyboard.dismiss();
    setErrBanner([]);
    setInfoBanner([]);

    try {
      setLoading(true);
      const response = await resendPasswordResetCode(requestId);
      if (response?.request_id) {
        setRequestId(response.request_id);
      }

      const resendAfter = response?.resend_after ?? 60;
      setCooldown(resendAfter);

      setInfoBanner([
        response?.message?.ar || 
        response?.message?.en || 
        "تم إعادة إرسال رمز التحقق بنجاح."
      ]);
    } catch (err) {
      const resp = err?.response;
      const data = resp?.data;
      
      if (resp?.status === 429) {
        const cooldownRemaining = data?.details?.resend_after ?? 60;
        setCooldown(cooldownRemaining);
      }
      
      const msg =
        data?.message?.ar ||
        data?.message?.en ||
        data?.detail ||
        data?.error ||
        "تعذر إعادة إرسال الرمز حالياً.";
      setErrBanner([String(msg)]);
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

      {infoBanner.length > 0 && (
        <View style={styles.infoBanner}>
          {infoBanner.map((m, i) => (
            <Text key={i} style={styles.infoBannerText}>{m}</Text>
          ))}
        </View>
      )}
      {errBanner.length > 0 && (
        <View style={styles.errorBanner}>
          {errBanner.map((m, i) => (
            <Text key={i} style={styles.errorBannerText}>{m}</Text>
          ))}
        </View>
      )}

      <View style={styles.form}>
        {!requestId ? (
          <>
            <Text style={styles.title}>استعادة كلمة المرور</Text>

            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل بريدك الإلكتروني"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
              returnKeyType="send"
              onSubmitEditing={() => canSend && onSend()}
            />

            <Button
              variant="auth"
              title={loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
              width={sx(200)}
              height={sy(52)}
              onPress={onSend}
              disabled={loading || !canSend}
              style={{ marginTop: sy(22), alignSelf: "center", opacity: !loading && canSend ? 1 : 0.6 }}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>تحقق من الرمز</Text>

            <Text style={styles.label}>أدخل الرمز المكون من 6 أرقام</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={code}
              onChangeText={(val) => setCode(val.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor="rgba(0,0,0,0.3)"
              textAlign="center"
              autoFocus
            />

            <TouchableOpacity
              onPress={cooldown === 0 ? onResend : undefined}
              disabled={cooldown > 0 || loading}
              style={{ marginTop: sy(14), alignSelf: "center" }}
            >
              <Text style={[styles.resendText, cooldown > 0 && styles.disabledResendText]}>
                {cooldown > 0 ? `إعادة إرسال الرمز خلال ${cooldown} ثانية` : "إعادة إرسال رمز التحقق"}
              </Text>
            </TouchableOpacity>

            <Button
              variant="auth"
              title={loading ? "جاري التحقق..." : "تحقق من الرمز"}
              width={sx(200)}
              height={sy(52)}
              onPress={onVerify}
              disabled={loading || code.trim().length !== 6}
              style={{ marginTop: sy(22), alignSelf: "center", opacity: !loading && code.trim().length === 6 ? 1 : 0.6 }}
            />
          </>
        )}
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.bottomRow}>
          <View style={styles.line} />
          <Text style={styles.muted}>تذكرت كلمة المرور؟</Text>
          <View style={styles.line} />
        </View>
        <Text style={styles.link} onPress={() => navigation.replace("Login")}>
          تسجيل الدخول
        </Text>
      </View>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(6), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  infoBanner: {
    marginHorizontal: sx(16),
    marginTop: sy(6),
    paddingVertical: sy(10),
    paddingHorizontal: sx(12),
    backgroundColor: "#E8F2FF",
    borderLeftWidth: 4,
    borderLeftColor: "#276EF1",
    borderRadius: sy(10),
  },
  infoBannerText: { color: "#0b3ea8", fontWeight: "700", fontSize: sp(12), marginBottom: sy(2), textAlign: "right" },

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
  errorBannerText: { color: "#9b1c1c", fontWeight: "800", fontSize: sp(12), marginBottom: sy(2), textAlign: "right" },

  form: { flex: 1, marginTop: sy(8), paddingHorizontal: sx(2) },
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
    fontSize: sp(14),
  },
  otpInput: {
    letterSpacing: sx(6),
    textAlign: "center",
    fontWeight: "800",
    fontSize: sp(18),
  },
  resendText: {
    color: themeColors.textPrimary,
    fontWeight: "700",
    fontSize: sp(13),
    textDecorationLine: "underline",
  },
  disabledResendText: {
    textDecorationLine: "none",
    opacity: 0.7,
  },

  bottomBlock: { alignItems: "center", marginBottom: sy(6) },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: sy(4),
    gap: sx(8),
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  muted: { color: themeColors.textMuted, fontWeight: "600", fontSize: sp(12) },
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
