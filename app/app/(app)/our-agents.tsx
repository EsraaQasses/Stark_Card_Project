import OurAgents from "../../src/screens/OurAgents";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

export default function OurAgentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pushRoute = (routePath: string) => {
    router.push(routePath as Href);
  };
  
  const navigation = {
    navigate: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "Home": "/(app)/home",
        "Menu": "/(app)/menu",
        "NewTransfer": "/(app)/new-transfer",
        "MyQRCode": "/(app)/my-qr-code",
        "PaymentMethodsList": "/(app)/payment-methods",
        "AgentQRConnect": "/(app)/agent-qr-connect",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      pushRoute(route);
    },
    goBack: () => router.back(),
  };

  const route = { params };
  return <OurAgents navigation={navigation} route={route} />;
}
