import OurAgents from "../../src/screens/OurAgents";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

export default function OurAgentsPublicScreen() {
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
        "SignUpExtra": "/(auth)/signup-extra",
        "Login": "/(auth)/login",
      };
      const route = routeMap[name] || `/(auth)/${name.toLowerCase()}`;
      if (navParams) pushRoute(route, navParams);
      else pushRoute(route);
    },
    goBack: () => router.back(),
  };

  const route = { params: { ...params, public: true } };
  return <OurAgents navigation={navigation} route={route} />;
}
