import NewTransfer from "../../src/screens/transactions/NewTransfer";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";

export default function NewTransferScreen() {
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
    navigate: (name: string, params?: any) => {
      const routeMap: Record<string, string> = {
        "MyWallet": "/(app)/my-wallet",
        "Home": "/(app)/home",
        "QRScanner": "/(app)/qr-scanner",
        "TransactionsList": "/(app)/transactions",
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

  return <NewTransfer navigation={navigation} route={route} />;
}
