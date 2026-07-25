import MyShippings from "../../src/screens/MyShippings";
import { useRouter, type Href } from "expo-router";

function toKebab(name: string) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // ShippingMethodInfo -> Shipping-Method-Info
    .replace(/_/g, "-")
    .toLowerCase(); // shipping-method-info
}

export default function MyShippingsScreen() {
  const router = useRouter();

  const pushRoute = (routePath: string, navParams?: Record<string, any>) => {
    const href = navParams
      ? ({ pathname: routePath, params: navParams } as Href)
      : (routePath as Href);
    router.push(href);
  };

  const navigation = {
    navigate: (name: string, navParams?: any) => {
      const routeMap: Record<string, string> = {
        Home: "/(app)/home",
        Menu: "/(app)/menu",
        NewDeposit: "/(app)/new-deposit",
        MyWallet: "/(app)/my-wallet",

        // ✅ مهمين عشان ما يصير رمادي
        PaymentMethodsList: "/(app)/payment-methods",
        ShippingMethodInfo: "/(app)/shipping-method-info",
        MyShippings: "/(app)/my-shippings",
        OurAgents: "/(app)/our-agents",

        // إذا موجودين عندك:
        MyQRCode: "/(app)/my-qr-code",
        NewTransfer: "/(app)/new-transfer",
        TakeMoney: "/(app)/take-money",
        Notifications: "/(app)/notifications",
        Profile: "/(app)/profile",
      };

      const known = routeMap[name];

      // ✅ بالـ Release: ممنوع نروح لمسار مجهول
      if (!known && !__DEV__) {
        router.back();
        return;
      }

      const route = known || `/(app)/${toKebab(name)}`;
      pushRoute(route, navParams);
    },
    goBack: () => router.back(),
  };

  return <MyShippings navigation={navigation as any} />;
}
