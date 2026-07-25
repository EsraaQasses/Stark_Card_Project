import TakeMoney from "../../src/screens/transactions/TakeMoney";
import { useRouter, type Href } from "expo-router";

export default function TakeMoneyScreen() {
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
        "TransactionsList": "/(app)/transactions",
        "Home": "/(app)/home",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      if (params) pushRoute(route, params);
      else pushRoute(route);
    },
    goBack: () => router.back(),
  };

  return <TakeMoney navigation={navigation} />;
}
