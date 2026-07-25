import GenericPayment from "../../src/screens/payments/GenericPayment";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";

export default function GenericPaymentScreen() {
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
        "PaymentMethodsList": "/(app)/payment-methods",
        "MyWallet": "/(app)/my-wallet",
        "Home": "/(app)/home",
        "NewTransfer": "/(app)/new-transfer",
        "MyQRCode": "/(app)/my-qr-code",
        "OurAgents": "/(app)/our-agents",
        "Menu": "/(app)/menu",
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

  return <GenericPayment route={route} navigation={navigation} />;
}
