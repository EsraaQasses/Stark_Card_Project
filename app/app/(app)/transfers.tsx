import TransfersList from "../../src/screens/transactions/TransfersList";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

export default function TransfersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pushRoute = (routePath: string) => {
    router.push(routePath as Href);
  };

  const navigation = {
    navigate: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "Home": "/(app)/home",
      };
      const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
      pushRoute(route);
    },
    goBack: () => router.back(),
  };

  return <TransfersList navigation={navigation} route={{ params }} />;
}
