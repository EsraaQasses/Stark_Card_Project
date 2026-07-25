import MyPayments from "../../src/screens/MyPayments";
import { useRouter, type Href } from "expo-router";

export default function MyPaymentsScreen() {
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
        "TransactionDetail": "/(app)/transaction-detail",
        "Home": "/(app)/home",
        "Menu": "/(app)/menu",
        "Products": "/(app)/products",
        "NewTransfer": "/(app)/new-transfer",
        "MyQRCode": "/(app)/my-qr-code",
        "PaymentMethodsList": "/(app)/payment-methods",
        "OurAgents": "/(app)/our-agents",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      if (params) {
        pushRoute(route, params);
      } else {
        pushRoute(route);
      }
    },
    goBack: () => router.back(),
  };

  return <MyPayments navigation={navigation} />;
}
