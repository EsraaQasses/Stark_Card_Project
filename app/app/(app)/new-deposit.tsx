import NewDeposit from "../../src/screens/transactions/NewDeposit";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

export default function NewDepositScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pushRoute = (routePath: string, navParams?: Record<string, any>) => {
    const href = navParams
      ? ({ pathname: routePath, params: navParams } as Href)
      : (routePath as Href);
    router.push(href);
  };
  
  const navigation = {
    navigate: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "PaymentMethodsList": "/(app)/payment-methods",
        "MyWallet": "/(app)/my-wallet",
        "Home": "/(app)/home",
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

  return <NewDeposit navigation={navigation} route={{ params }} />;
}
