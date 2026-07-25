import Favorite from "../../src/screens/Favorite";
import { useRouter, type Href } from "expo-router";

export default function FavoriteScreen() {
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
        "Products": "/(app)/products",
        "Payment": "/(app)/payment",
        "Home": "/(app)/home",
        "Menu": "/(app)/menu",
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

  return <Favorite navigation={navigation} />;
}
