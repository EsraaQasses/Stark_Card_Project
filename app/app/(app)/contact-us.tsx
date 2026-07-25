import { useRouter, type Href } from "expo-router";
import ContactUs from "../../src/screens/ContactUs";

export default function ContactUsScreen() {
  const router = useRouter();

  const pushRoute = (routePath: string) => {
    router.push(routePath as Href);
  };
  
  const navigation = {
    navigate: (name: string) => {
      const routeMap: Record<string, string> = {
        "Home": "/(app)/home",
        "Menu": "/(app)/menu",
      };
      const route = routeMap[name] || "/(app)/home";
      pushRoute(route);
    },
    goBack: () => router.back(),
  };

  return <ContactUs navigation={navigation} />;
}
