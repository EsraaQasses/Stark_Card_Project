import { useRouter } from "expo-router";
import AgentCashouts from "../../src/screens/AgentCashouts";

export default function AgentCashoutsRoute() {
  const router = useRouter();
  const navigation = {
    navigate: (name: string) => router.push(`/(app)/${name.toLowerCase()}` as never),
    goBack: () => router.back(),
  };
  return <AgentCashouts navigation={navigation} />;
}
