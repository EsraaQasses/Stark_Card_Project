import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthProvider, { useAuth } from "../src/context/AuthProvider";
import { CurrencyProvider } from "../src/context/CurrencyProvider";
import { initI18n } from "../src/i18n";
import { APP_ROUTES, AUTH_ROUTES, LEGACY_AUTH_PATHS, ROOT_ROUTES } from "../src/shared/navigation/routes";
import { AppLoadingState } from "../src/shared/ui/primitives";
import { loadSavedLanguage } from "../src/utils/lang";


function RootLayoutNav() {
  const { user, booting } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const lastRedirectRef = useRef({ path: '', time: 0 });

  const safeReplace = useCallback((to: string) => {
    const now = Date.now();
    const currentPath = pathname || segments.join('/');
    if (to === currentPath && now - lastRedirectRef.current.time < 1000) {
      return;
    }
    lastRedirectRef.current = { path: to, time: now };
    router.replace(to as any);
  }, [pathname, router, segments]);

  useEffect(() => {
    if (booting) return;

    const currentPath = pathname || `/${segments.join("/")}`;
    // التحقق من أننا في مجموعة auth سواء بالمسار الكامل أو المختصر
    const inAuthGroup = segments[0] === '(auth)' ||
      currentPath.startsWith("/(auth)/") ||
      LEGACY_AUTH_PATHS.some(p => currentPath.startsWith(p));

    const inAppGroup = segments[0] === '(app)' || currentPath.startsWith("/(app)/");
    const inFirstPage = currentPath === "/first-page";
    const inOnboarding = currentPath === "/onboarding";
    const inResetPassword = currentPath === AUTH_ROUTES.ResetPassword || currentPath === "/reset-password";

    // إذا كان المستخدم في first-page أو onboarding، لا نتدخل - نتركهم يتحكمون
    if (inFirstPage || inOnboarding) {
      return;
    }

    // DEBUG LOGGING
    if (__DEV__) console.log(`[Layout] Path: ${currentPath}, User: ${!!user}, InAuth: ${inAuthGroup}`);

    // إذا المستخدم يحاول الدخول لصفحات الـ auth (مثل signup)، لا نتدخل ونتركه يكمل
    if (inAuthGroup) {
      // فقط إذا كان مسجل دخول، نمنعه من دخول auth ونوجهه لـ home
      if (user && !inResetPassword) {
        if (__DEV__) console.log("[Layout] Redirecting to home because user && inAuthGroup");
        safeReplace(APP_ROUTES.Home);
      }
      return;
    }

    // إذا لا يوجد مستخدم ولا هو في auth group
    if (!user) {
      if (__DEV__) console.log("[Layout] Redirecting to login because !user && !inAuthGroup");
      safeReplace(AUTH_ROUTES.Login);
      return;
    }

    // إذا المستخدم في root path
    if (currentPath === "/" || currentPath === "") {
      safeReplace(ROOT_ROUTES.FirstPage);
    }
  }, [user, booting, segments, pathname, safeReplace]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    "Almarai-Regular": require("../assets/fonts/Almarai-Regular.ttf"),
    "Almarai-Light": require("../assets/fonts/Almarai-Light.ttf"),
    "Almarai-Bold": require("../assets/fonts/Almarai-Bold.ttf"),
    "Almarai-ExtraBold": require("../assets/fonts/Almarai-ExtraBold.ttf"),
  });

  useEffect(() => {
    // تهيئة i18n عند بدء التطبيق
    (async () => {
      try {
        // تهيئة i18n باللغة الافتراضية
        initI18n("ar");
        // تحميل اللغة المحفوظة (دائماً عربية)
        const { needsReload } = await loadSavedLanguage();

        if (needsReload) {
          // يمكن إضافة إعادة تشغيل هنا إذا لزم الأمر، لكن Expo Router عادة يتعامل مع التغيير
          // Updates.reloadAsync();
        }

        setI18nReady(true);
      } catch (error) {
        console.warn("Failed to initialize i18n:", error);
        setI18nReady(true); // نكمل حتى لو فشل
      }
    })();
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn("Failed to load app fonts:", fontError);
    }
  }, [fontError]);

  if (!i18nReady || (!fontsLoaded && !fontError)) {
    return <AppLoadingState />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CurrencyProvider>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
          <RootLayoutNav />
        </CurrencyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
