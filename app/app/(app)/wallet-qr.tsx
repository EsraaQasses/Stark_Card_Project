import WalletQR from "../../src/screens/WalletQR";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";

export default function WalletQRScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const pushRoute = (routePath: string, navParams?: Record<string, any>) => {
        const href = navParams
            ? ({ pathname: routePath, params: navParams } as Href)
            : (routePath as Href);
        router.push(href);
    };

    const navigation = {
        navigate: (name: string, navParams?: any) => {
            const routeMap: Record<string, string> = {
                "MyWallet": "/(app)/my-wallet",
                "Home": "/(app)/home",
            };
            const route = routeMap[name] || `/(app)/${name.toLowerCase()}`;
            if (navParams) {
                pushRoute(route, navParams);
            } else {
                pushRoute(route);
            }
        },
        goBack: () => router.back(),
    };

    const route = {
        params: params,
    };

    return <WalletQR navigation={navigation} route={route} />;
}
