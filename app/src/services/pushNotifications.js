import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import api from "../api/client";


// ========================================
// كيف يظهر الإشعار إذا التطبيق مفتوح
// ========================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


// ========================================
// Android Notification Channel
// ========================================

async function createAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    "default",
    {
      name: "Stark Card",

      importance:
        Notifications.AndroidImportance.MAX,

      sound: "default",

      vibrationPattern: [
        0,
        250,
        250,
        250,
      ],

      enableVibrate: true,

      enableLights: true,

      showBadge: true,
    },
  );
}


// ========================================
// الحصول على Expo Push Token
// ========================================

export async function getPushToken() {
  try {
    await createAndroidNotificationChannel();


    // الصلاحيات الحالية
    let permissions =
      await Notifications.getPermissionsAsync();


    // إذا المستخدم ما أعطى صلاحية
    if (
      permissions.status
      !== "granted"
    ) {
      permissions =
        await Notifications.requestPermissionsAsync();
    }


    if (
      permissions.status
      !== "granted"
    ) {
      console.warn(
        "Notification permission was not granted.",
      );

      return null;
    }


    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId
      || Constants?.easConfig?.projectId;


    if (!projectId) {
      console.warn(
        "Expo projectId not found.",
      );

      return null;
    }


    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });


    const token =
      tokenResponse?.data;


    if (!token) {
      return null;
    }


    if (__DEV__) {
      console.log(
        "Expo Push Token:",
        token,
      );
    }


    return token;

  } catch (error) {
    console.warn(
      "Failed to get push token:",
      error,
    );

    return null;
  }
}


// ========================================
// تسجيل الجهاز عند الباك
// ========================================

export async function registerDeviceForPushNotifications() {
  try {
    const token =
      await getPushToken();


    if (!token) {
      return null;
    }


    /*
     * هاد endpoint رح نضيفه بالباك بالخطوة الجاية.
     *
     * الـapi client عندك أصلاً base URL تبعه:
     * https://.../api
     */
    await api.post(
      "system/push-tokens/register/",
      {
        token,
        platform: Platform.OS,
      },
    );


    if (__DEV__) {
      console.log(
        "Push token registered successfully.",
      );
    }


    return token;

  } catch (error) {
    /*
     * ما نخلي مشكلة Push Notifications
     * توقف التطبيق.
     */
    console.warn(
      "Push registration failed:",
      error?.response?.data
        || error?.message
        || error,
    );

    return null;
  }
}


// ========================================
// إزالة الجهاز - مفيدة عند Logout
// ========================================

export async function unregisterDevicePushToken() {
  try {
    const token =
      await getPushToken();


    if (!token) {
      return;
    }


    await api.post(
      "system/push-tokens/unregister/",
      {
        token,
      },
    );

  } catch (error) {
    console.warn(
      "Push token unregister failed:",
      error?.response?.data
        || error?.message
        || error,
    );
  }
}