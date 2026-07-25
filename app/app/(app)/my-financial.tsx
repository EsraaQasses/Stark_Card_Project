import MyFinancial from "../../src/screens/MyFinancial";
import { useRouter, type Href } from "expo-router";

export default function MyFinancialScreen() {
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
        "Home": "/(app)/home",
        "Menu": "/(app)/menu",
        "MyWallet": "/(app)/my-wallet",
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

  return <MyFinancial navigation={navigation} />;
}
