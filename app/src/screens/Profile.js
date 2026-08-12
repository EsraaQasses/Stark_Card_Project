// src/screens/Profile.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  I18nManager,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import PageLayout from "../ui/PageLayout";           // ✅ الغلاف الموحّد (BottomNav + SideMenu)
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";
import { AppCard, AppSectionTitle } from "../shared/ui/primitives";
import {
  colors as themeColors,
  fontFamilies,
  radius,
  shadows,
  spacing,
  typography,
} from "../shared/theme";
import api from "../api/client";
import { disconnectFromAgent } from "../api/agent";
import { useAuth } from "../context/AuthProvider";
import { getAccessToken } from "../shared/storage/authStorage";

const COLOR = {
  primary: themeColors.brand.primary,
  primaryDark: themeColors.brand.primaryDark,
  text: themeColors.text.primary,
  line: themeColors.border.default,
  pill: themeColors.surface.cardSoft,
  white: themeColors.surface.background,
  danger: themeColors.status.danger,
  success: themeColors.status.success,
  muted: themeColors.text.muted,
  bgSoft: themeColors.surface.soft,
};
const BASE_W = 390, BASE_H = 844;

export default function Profile({ navigation }) {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: W, height: H } = useWindowDimensions();
  const RTL = I18nManager.isRTL;
  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);

  const NAV_HEIGHT = sy(64);
  const contentPadBottom = NAV_HEIGHT + insets.bottom + sy(12);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  // server data
  const [raw, setRaw] = useState(null);

  // form state
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [optionalPhone, setOptionalPhone] = useState("");
  const [dark, setDark] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const GAP_SM = sy(8);
  const GAP_XS = sy(6);
  const R = sx(18);

  const assignFromUser = useCallback((u) => {
    const full = u?.full_name || "";
    const parts = full.trim().split(" ");
    setFirst(parts[0] || "");
    setLast(parts.length > 1 ? parts.slice(1).join(" ") : "");
    setEmail(u?.email || "");
    setUserName(u?.name || "");
    setPhone(u?.phone || "");
    setCountry(u?.country || "");
    setOptionalPhone(u?.optional_phone || "");
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setError("");
      const token = await getAccessToken();
      if (!token) throw new Error("NO_TOKEN");
      const res = await api.get("/users/me/", { headers: { Authorization: `Bearer ${token}` } });
      const u = res.data || {};
      setRaw(u);
      assignFromUser(u);
    } catch (e) {
      if (e?.message === "NO_TOKEN" || e?.response?.status === 401) {
        await signOut();
        Alert.alert(t("common.system") || "System", t("menu.logoutBody") || "Please login again.");
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }
      setError(e?.response?.data?.error || t("wallet.errors.load") || "Failed to load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignFromUser, navigation, signOut, t]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  // track dirty state
  const onField = (setter) => (v) => {
    setter(v);
    setDirty(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setDirty(false);
  };

  // validators
  const isEmailValid = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhoneValid = (v) => !v || /^[0-9+\-()\s]{6,}$/.test(v);

  const onSave = async () => {
    if (!isEmailValid(email)) return Alert.alert(t("common.system"), t("profile.invalidEmail") || "Please enter a valid email address.");
    if (!isPhoneValid(phone)) return Alert.alert(t("common.system"), t("profile.invalidPhone") || "Please enter a valid phone number.");
    try {
      setSaving(true);
      setError("");
      const payload = {
        full_name: [first.trim(), last.trim()].filter(Boolean).join(" "),
        name: userName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country: country.trim(),
        optional_phone: optionalPhone.trim(),
      };
      const { data } = await api.patch("/users/me/", payload);
      setRaw(data);
      assignFromUser(data);
      setDirty(false);
      setEditMode(false);
      Alert.alert(t("common.ok", "OK"), t("profile.saved", "Profile updated."));
    } catch (e) {
      const responseData = e?.response?.data;
      const message = responseData?.detail
        || responseData?.error
        || Object.values(responseData || {}).flat().join(", ")
        || t("profile.saveFailed", "Failed to update profile.");
      Alert.alert(t("common.error", "Error"), String(message));
    } finally {
      setSaving(false);
    }
  };


  const onDisconnectAgent = async () => {
    Alert.alert(
      t("agents.disconnectTitle", "Disconnect agent?"),
      t("agents.disconnectBody", "This will remove your connected agent."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("agents.disconnectCta", "Disconnect"),
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectFromAgent();
              await fetchProfile();
              Alert.alert(t("common.ok", "OK"), t("agents.disconnected", "Agent disconnected."));
            } catch (e) {
              const msg = e?.response?.data?.error || e?.message || "Failed to disconnect.";
              Alert.alert(t("common.error", "Error"), String(msg));
            }
          },
        },
      ]
    );
  };

  const onChangePassword = async () => {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert(t("common.error", "Error"), t("profile.passwordValidation", "Check the current password, use at least 8 characters, and confirm the new password."));
      return;
    }
    try {
      setChangingPassword(true);
      await api.post("/users/password-change/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert(t("common.ok", "OK"), t("profile.passwordChanged", "Password changed. Please sign in again."), [
        {
          text: t("auth.login", "Sign in"),
          onPress: async () => {
            await signOut();
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          },
        },
      ]);
    } catch (e) {
      const data = e?.response?.data;
      Alert.alert(
        t("common.error", "Error"),
        String(data?.message?.ar || data?.message?.en || data?.detail || data?.error || t("profile.passwordChangeFailed", "Failed to change password."))
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const onDeleteAccount = async () => {
    if (deletingAccount) return;
    Alert.alert(
      t("profile.deleteTitle", "Delete account?"),
      t("profile.deleteBody", "This action is permanent and will remove your account."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("profile.deleteCta", "Delete"),
          style: "destructive",
          onPress: async () => {
            if (deletingAccount) return;
            setDeletingAccount(true);
            try {
              const token = await getAccessToken();
              await api.delete("/users/me/delete/", { headers: { Authorization: `Bearer ${token}` } });
              await signOut();
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (e) {
              const msg = e?.response?.data?.error || e?.message || "Failed to delete account.";
              Alert.alert(t("common.error", "Error"), String(msg));
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };


  const AgentCard = () => {
    const agent = raw?.connected_agent;
    if (!agent) return null;
    const copy = async () => {
      if (agent.agent_code) {
        await Clipboard.setStringAsync(agent.agent_code);
        Alert.alert(t("common.ok"), t("profile.copied"));
      }
    };
    return (
      <AppCard soft style={[styles.infoCard, { borderRadius: R, padding: sx(14), marginBottom: sy(12) }]}>
        <AppSectionTitle title={t("profile.connectedAgent")} />
        <Text style={[styles.infoText, { marginTop: sy(6) }]}>
          {agent.full_name || "—"}
        </Text>
        <View style={{ flexDirection: RTL ? "row-reverse" : "row", alignItems: "center", marginTop: sy(6) }}>
          <Text style={styles.mutedText}>{t("profile.agentCode") || "Code"}: </Text>
          <Text style={styles.strongText}>{agent.agent_code || "—"}</Text>
          {!!agent.agent_code && (
            <Pressable onPress={copy} style={[styles.smallAction, { marginStart: sx(12), paddingHorizontal: sx(10), paddingVertical: sy(6), borderRadius: sx(10) }]}>
              <Text style={styles.smallActionText}>{t("profile.copy")}</Text>
            </Pressable>
          )}
        </View>
      </AppCard>
    );
  };

  const WalletCard = () => {
    const balances = raw?.balances || {};
    const entries = Object.entries(balances);
    if (!entries.length) return null;
    return (
      <AppCard soft style={[styles.infoCard, { borderRadius: R, padding: sx(14), marginBottom: sy(12) }]}>
        <AppSectionTitle title={t("profile.walletBalances")} />
        <View style={{ flexDirection: RTL ? "row-reverse" : "row", gap: sx(10), flexWrap: "wrap", marginTop: sy(10) }}>
          {entries.map(([cur, val]) => (
            <View
              key={cur}
              style={{
                paddingVertical: sy(8),
                paddingHorizontal: sx(12),
                backgroundColor: COLOR.white,
                borderRadius: sx(radius.md),
                borderWidth: 1,
                borderColor: COLOR.line,
              }}
            >
              <Text style={styles.strongText}>{cur}: {Number(val).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </AppCard>
    );
  };

  // ✅ Wallet Number (FRONTEND-ONLY): يلتقط من wallet_number إن وجد، وإلا من الهاتف
  

  const disabled = !editMode; // view-only mode lock

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu={true}>
      {/* خلفية سبينر شكلية */}
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <AppHeader title={t("profile.title")} />

        {/* avatar */}
        <View style={{ alignItems: "center", marginTop: sy(20), marginBottom: sy(16) }}>
          <View
            style={{
              width: sx(110),
              height: sx(110),
              borderRadius: sx(56),
              borderWidth: sx(3),
              borderColor: COLOR.primary,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLOR.bgSoft,
            }}
          >
            <Image
              source={require("../assets/icons/user.png")}
              resizeMode="contain"
              style={{ width: sx(64), height: sx(64), tintColor: COLOR.primary }}
              accessibilityLabel="Avatar"
            />
          </View>

          {/* Edit/View toggle */}
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            style={{
              marginTop: sy(10),
              paddingVertical: sy(8),
              paddingHorizontal: sx(16),
              borderRadius: sx(16),
              backgroundColor: editMode ? "#FFF7ED" : COLOR.bgSoft,
              borderWidth: 1,
              borderColor: COLOR.line,
            }}
            accessibilityLabel="Toggle edit mode"
          >
            <Text style={[styles.modeText, { color: editMode ? "#B54708" : COLOR.primary }]}>
              {editMode ? t("profile.editing") : t("profile.viewOnly")}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: sy(20), paddingBottom: contentPadBottom }}>
            <ActivityIndicator size="large" color={COLOR.primary} />
            <Text style={[styles.loadingText, { marginTop: sy(8) }]}>{t("common.loading")}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: sx(20), paddingBottom: contentPadBottom }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {!!error && (
              <AppCard soft style={[styles.errorCard, { marginBottom: sy(8) }]}>
                <Text style={styles.errorText}>{error}</Text>
              </AppCard>
            )}

            {/* Wallet + Agent */}
            <WalletCard />
            <AgentCard />


            {/* First + Last */}
            <AppCard style={styles.formCard}>
              <View
                style={{
                  flexDirection: RTL ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  marginBottom: GAP_SM,
                }}
              >
                <Field
                  label={t("profile.firstName")}
                  value={first}
                  onChangeText={onField(setFirst)}
                  placeholder={t("profile.firstName")}
                  sx={sx}
                  sy={sy}
                  pillStyle={{ borderRadius: R }}
                  containerStyle={{ width: "48.5%" }}
                  editable={!disabled}
                />
                <Field
                  label={t("profile.lastName")}
                  value={last}
                  onChangeText={onField(setLast)}
                  placeholder={t("profile.lastName")}
                  sx={sx}
                  sy={sy}
                  pillStyle={{ borderRadius: R }}
                  containerStyle={{ width: "48.5%" }}
                  editable={!disabled}
                />
              </View>

            <Field
              label={t("profile.email")}
              value={email}
              onChangeText={onField(setEmail)}
              placeholder="name@gmail.com"
              keyboardType="email-address"
              sx={sx}
              sy={sy}
              showPen
              containerStyle={{ marginBottom: GAP_SM }}
              pillStyle={{ borderRadius: R, borderColor: !isEmailValid(email) ? "#FFB3B3" : COLOR.line }}
              editable={!disabled}
            />

            <Field
              label={t("profile.userName")}
              value={userName}
              onChangeText={() => {}}
              placeholder={t("profile.userName")}
              sx={sx}
              sy={sy}
              showPen={false}
              containerStyle={{ marginBottom: GAP_SM, opacity: 0.7 }}
              pillStyle={{ borderRadius: R }}
              editable={false} // username not editable
            />

            <Field
              label={t("profile.phone")}
              value={phone}
              onChangeText={onField(setPhone)}
              keyboardType="phone-pad"
              sx={sx}
              sy={sy}
              showPen
              containerStyle={{ marginBottom: GAP_XS }}
              pillStyle={{ borderRadius: R, borderColor: !isPhoneValid(phone) ? "#FFB3B3" : COLOR.line }}
              editable={!disabled}
            />

            <Field
              label={t("profile.country")}
              value={country}
              onChangeText={onField(setCountry)}
              placeholder={t("profile.country")}
              sx={sx}
              sy={sy}
              showPen
              containerStyle={{ marginBottom: GAP_XS }}
              pillStyle={{ borderRadius: R }}
              editable={!disabled}
            />

            <Field
              label={t("profile.optionalPhone")}
              value={optionalPhone}
              onChangeText={onField(setOptionalPhone)}
              keyboardType="phone-pad"
              sx={sx}
              sy={sy}
              showPen
              containerStyle={{ marginBottom: GAP_XS }}
              pillStyle={{ borderRadius: R }}
              editable={!disabled}
            />

            {/* Dark Mode (local only) */}
            <View
              style={{
                marginTop: GAP_XS,
                marginBottom: sy(12),
                flexDirection: RTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[styles.settingLabel, { fontSize: sx(14) }]}>{t("profile.darkMode")}</Text>
              <Toggle
                active={dark}
                onPress={() => setDark((v) => !v)}
                sx={sx}
                sy={sy}
                onColor={COLOR.success}
                offColor={COLOR.danger}
              />
            </View>
            </AppCard>

            <AppCard style={styles.formCard}>
              <AppSectionTitle title={t("profile.changePassword", "Change password")} />
              <Field
                label={t("profile.currentPassword", "Current password")}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                sx={sx}
                sy={sy}
                secureTextEntry
                containerStyle={{ marginBottom: GAP_SM }}
                pillStyle={{ borderRadius: R }}
              />
              <Field
                label={t("profile.newPassword", "New password")}
                value={newPassword}
                onChangeText={setNewPassword}
                sx={sx}
                sy={sy}
                secureTextEntry
                containerStyle={{ marginBottom: GAP_SM }}
                pillStyle={{ borderRadius: R }}
              />
              <Field
                label={t("profile.confirmPassword", "Confirm password")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                sx={sx}
                sy={sy}
                secureTextEntry
                containerStyle={{ marginBottom: GAP_SM }}
                pillStyle={{ borderRadius: R }}
              />
              <Pressable
                onPress={onChangePassword}
                disabled={changingPassword}
                style={[styles.saveBtn, { height: sy(44), borderRadius: sx(18), opacity: changingPassword ? 0.5 : 1 }]}
              >
                <Text style={styles.saveText}>
                  {changingPassword ? t("profile.saving", "Saving...") : t("profile.changePassword", "Change password")}
                </Text>
              </Pressable>
            </AppCard>


            {/* Agent actions */}
            {!!raw?.connected_agent && (
              <Pressable
                onPress={onDisconnectAgent}
                style={{
                  marginTop: sy(8),
                  marginBottom: sy(6),
                  alignSelf: "center",
                  paddingHorizontal: sx(16),
                  paddingVertical: sy(10),
                  borderRadius: sx(radius.md),
                  backgroundColor: "#FFF4E5",
                  borderWidth: 1,
                  borderColor: "#FFD8A8",
                }}
              >
                <Text style={[styles.actionText, { color: "#B54708" }]}>{t("agents.disconnectCta", "Disconnect agent")}</Text>
              </Pressable>
            )}

            {/* Delete account */}
            <Pressable
              onPress={onDeleteAccount}
              disabled={deletingAccount}
              style={{
                marginTop: sy(6),
                marginBottom: sy(12),
                alignSelf: "center",
                paddingHorizontal: sx(16),
                paddingVertical: sy(10),
                borderRadius: sx(radius.md),
                backgroundColor: "#FFF0F0",
                borderWidth: 1,
                borderColor: "#FFD6D6",
                opacity: deletingAccount ? 0.6 : 1,
              }}
            >
              <Text style={[styles.actionText, { color: COLOR.danger }]}>{deletingAccount ? t("common.loading", "Deleting…") : t("profile.delete", "Delete account")}</Text>
            </Pressable>

            {/* Save */}
            <Pressable
              onPress={onSave}
              disabled={!editMode || !dirty || saving}
              style={[
                styles.saveBtn,
                {
                  height: sy(48),
                  minWidth: sx(178),
                  borderRadius: sx(18),
                  opacity: (!editMode || !dirty || saving) ? 0.5 : 1,
                },
              ]}
              accessibilityLabel="Save profile"
            >
              <Text style={[styles.saveText, { fontSize: sx(18) }]}>
                {saving ? t("profile.saving") : t("profile.save")}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </PageLayout>
  );
}

/* ---------- subcomponents ---------- */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  showPen = true,
  containerStyle,
  pillStyle,
  sx,
  sy,
  editable = true,
  secureTextEntry = false,
}) {
  const RTL = I18nManager.isRTL;
  return (
    <View style={[{ width: "100%" }, containerStyle]}>
      <Text style={[styles.fieldLabel, { fontSize: sx(12.5), marginBottom: sy(4) }]}>{label}</Text>
      <View
        style={[
          {
            height: sy(46),
            backgroundColor: COLOR.pill,
            borderWidth: 1,
            borderColor: COLOR.line,
            flexDirection: RTL ? "row-reverse" : "row",
            alignItems: "center",
            paddingHorizontal: sx(14),
            opacity: editable ? 1 : 0.7,
          },
          styles.fieldPill,
          pillStyle,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(0,0,0,0.5)"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={[styles.fieldInput, { fontSize: sx(16), textAlign: RTL ? "right" : "left" }]}
          editable={editable}
        />
        {showPen && (
          <Pressable
            style={{ width: sx(24), height: sx(24), alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Edit field"
          >
            <Text style={[styles.penText, { fontSize: sx(14) }]}>✎</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Toggle({ active, onPress, sx, sy, onColor, offColor }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: sx(50),
        height: sy(25),
        borderRadius: sy(14),
        padding: sy(3),
        backgroundColor: active ? onColor : offColor,
        justifyContent: "center",
      }}
      accessibilityLabel="Toggle setting"
    >
      <View
        style={{
          width: sy(20),
          height: sy(20),
          borderRadius: sy(11),
          backgroundColor: "#fff",
          alignSelf: active ? "flex-end" : "flex-start",
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  saveBtn: {
    alignSelf: "center",
    backgroundColor: COLOR.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 22,
    ...shadows.soft,
  },
  actionText: {
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  errorCard: {
    alignItems: "center",
    padding: spacing.md,
  },
  errorText: {
    color: COLOR.danger,
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
  fieldInput: {
    color: COLOR.text,
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  fieldLabel: {
    color: COLOR.text,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  fieldPill: {
    ...shadows.soft,
  },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  infoCard: {
    borderColor: COLOR.line,
  },
  infoText: {
    color: COLOR.text,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body.fontSize,
  },
  loadingText: {
    color: COLOR.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body.fontSize,
  },
  modeText: {
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  mutedText: {
    color: COLOR.muted,
    fontFamily: fontFamilies.regular,
  },
  penText: {
    color: COLOR.primary,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  saveText: {
    color: COLOR.white,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  settingLabel: {
    color: COLOR.text,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  smallAction: {
    backgroundColor: COLOR.bgSoft,
    borderColor: COLOR.line,
    borderWidth: 1,
  },
  smallActionText: {
    color: COLOR.primary,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  strongText: {
    color: COLOR.text,
    fontFamily: fontFamilies.bold,
    fontWeight: "700",
  },
  /* Decorative spinner bg */
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
