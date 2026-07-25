import Payment from "../../src/screens/Payment";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigationShim();

  const route = {
    params: params || {},
  };

  return <Payment route={route} navigation={navigation} />;
}

