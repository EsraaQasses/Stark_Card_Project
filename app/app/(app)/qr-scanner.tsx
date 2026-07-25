import QRScanner from "../../src/screens/QRScanner";
import { useRouter, type Href } from "expo-router";

export default function QRScannerScreen() {
  const router = useRouter();

  const pushRoute = (routePath: string, navParams?: Record<string, any>) => {
    const href = navParams
      ? ({ pathname: routePath, params: navParams } as Href)
      : (routePath as Href);
    router.push(href);
  };
  
  const navigation = {
    navigate: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "PayToUser": "/(app)/pay-to-user",
        "NewTransfer": "/(app)/new-transfer",
        "Home": "/(app)/home",
        "MyQRCode": "/(app)/my-qr-code",
        "PaymentMethodsList": "/(app)/payment-methods",
        "OurAgents": "/(app)/our-agents",
        "Menu": "/(app)/menu",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      if (params) {
        pushRoute(route, params);
      } else {
        pushRoute(route);
      }
    },
    replace: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "PayToUser": "/(app)/pay-to-user",
        "NewTransfer": "/(app)/new-transfer",
        "Home": "/(app)/home",
        "MyQRCode": "/(app)/my-qr-code",
        "PaymentMethodsList": "/(app)/payment-methods",
        "OurAgents": "/(app)/our-agents",
        "Menu": "/(app)/menu",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      if (params) {
        router.replace({ pathname: route, params } as Href);
      } else {
        router.replace(route as Href);
      }
    },
    goBack: () => router.back(),
  };

  return <QRScanner navigation={navigation} />;
}
