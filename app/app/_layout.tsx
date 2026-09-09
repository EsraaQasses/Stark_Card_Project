import {
  Stack,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";

import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AuthProvider, {
  useAuth,
} from "../src/context/AuthProvider";

import { CurrencyProvider } from "../src/context/CurrencyProvider";
import { initI18n } from "../src/i18n";

import {
  APP_ROUTES,
  AUTH_ROUTES,
  LEGACY_AUTH_PATHS,
  ROOT_ROUTES,
} from "../src/shared/navigation/routes";

import { loadSavedLanguage } from "../src/utils/lang";

import PushNotificationsBootstrap from "../src/components/PushNotificationsBootstrap";


// نخلي Splash الحقيقي ظاهر أثناء تجهيز التطبيق
void SplashScreen.preventAutoHideAsync().catch(() => {});


function RootLayoutNav() {
  const { user, booting } = useAuth();

  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  const lastRedirectRef = useRef({
    path: "",
    time: 0,
  });


  const safeReplace = useCallback(
    (to: string) => {
      const now = Date.now();

      const currentPath =
        pathname || segments.join("/");

      if (
        to === currentPath
        && now - lastRedirectRef.current.time < 1000
      ) {
        return;
      }

      lastRedirectRef.current = {
        path: to,
        time: now,
      };

      router.replace(to as any);
    },
    [
      pathname,
      router,
      segments,
    ],
  );


  useEffect(() => {
    if (booting) return;

    const currentPath =
      pathname || `/${segments.join("/")}`;

    const inAuthGroup =
      segments[0] === "(auth)"
      || currentPath.startsWith("/(auth)/")
      || LEGACY_AUTH_PATHS.some(
        (path) => currentPath.startsWith(path),
      );

    const inFirstPage =
      currentPath === "/first-page";

    const inOnboarding =
      currentPath === "/onboarding";

    const inResetPassword =
      currentPath === AUTH_ROUTES.ResetPassword
      || currentPath === "/reset-password";


    if (
      inFirstPage
      || inOnboarding
    ) {
      return;
    }


    if (inAuthGroup) {
      if (
        user
        && !inResetPassword
      ) {
        safeReplace(
          APP_ROUTES.Home,
        );
      }

      return;
    }


    if (!user) {
      safeReplace(
        AUTH_ROUTES.Login,
      );

      return;
    }


    if (
      currentPath === "/"
      || currentPath === ""
    ) {
      safeReplace(
        ROOT_ROUTES.FirstPage,
      );
    }
  }, [
    user,
    booting,
    segments,
    pathname,
    safeReplace,
  ]);


  useEffect(() => {
    if (booting) return;

    // الجلسة صارت جاهزة، نخفي Splash
    void SplashScreen.hideAsync().catch(() => {});
  }, [booting]);


  // ما عاد نظهر AppLoadingState
  if (booting) {
    return null;
  }


  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}


export default function RootLayout() {
  const [
    i18nReady,
    setI18nReady,
  ] = useState(false);


  const [
    fontsLoaded,
    fontError,
  ] = useFonts({
    "Almarai-Regular":
      require("../assets/fonts/Almarai-Regular.ttf"),

    "Almarai-Light":
      require("../assets/fonts/Almarai-Light.ttf"),

    "Almarai-Bold":
      require("../assets/fonts/Almarai-Bold.ttf"),

    "Almarai-ExtraBold":
      require("../assets/fonts/Almarai-ExtraBold.ttf"),
  });


  useEffect(() => {
    (async () => {
      try {
        initI18n("ar");

        await loadSavedLanguage();

        setI18nReady(true);
      } catch (error) {
        console.warn(
          "Failed to initialize i18n:",
          error,
        );

        setI18nReady(true);
      }
    })();
  }, []);


  useEffect(() => {
    if (fontError) {
      console.warn(
        "Failed to load app fonts:",
        fontError,
      );
    }
  }, [fontError]);


  // خلي Splash الحقيقي ظاهر بدل الكرت الأبيض
  if (
    !i18nReady
    || (
      !fontsLoaded
      && !fontError
    )
  ) {
    return null;
  }


  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushNotificationsBootstrap />
          <CurrencyProvider>

            <StatusBar
              barStyle="dark-content"
              backgroundColor="transparent"
              translucent
            />

            <RootLayoutNav />

          </CurrencyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}