import PayToUser from "../../src/screens/PayToUser";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";

export default function PayToUserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const route = {
    params: params || {},
  };

  const pushRoute = (routePath: string, navParams?: Record<string, any>) => {
    const href = navParams
      ? ({ pathname: routePath, params: navParams } as Href)
      : (routePath as Href);
    router.push(href);
  };
  
  const navigation = {
    navigate: (name: string, navParams?: any) => {
      const routeMap: Record<string, string> = {
        "QRScanner": "/(app)/qr-scanner",
        "Home": "/(app)/home",
        "Payment": "/(app)/payment",
      };
      const routePath = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      if (navParams) {
        pushRoute(routePath, navParams);
      } else {
        pushRoute(routePath);
      }
    },
    goBack: () => router.back(),
  };

  return <PayToUser route={route} navigation={navigation} />;
}
