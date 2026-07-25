import LanguageSelect from "../../src/screens/LanguageSelect";
import { useRouter, type Href } from "expo-router";

export default function LanguageSelectScreen() {
  const router = useRouter();

  const pushRoute = (routePath: string) => {
    router.push(routePath as Href);
  };
  
  const navigation = {
    navigate: (name: string) => {
      if (name === "FirstPage") {
        router.replace("/(auth)/first-page" as Href);
      } else {
        pushRoute(`/(auth)/${name.toLowerCase()}`);
      }
    },
    goBack: () => router.back(),
    replace: (name: string) => {
      router.replace(`/(auth)/${name.toLowerCase()}` as Href);
    },
  };

  return <LanguageSelect navigation={navigation} />;
}
