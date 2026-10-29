import { checkoutProductId } from "../../src/features/payments/model/checkoutRoute";
import { useAuth } from "../../src/context/AuthProvider";
import Payment from "../../src/screens/Payment";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigationShim();
  const { user } = useAuth();

  const route = {
    params: params || {},
  };

  return <Payment key={`${user?.id ?? "guest"}:${checkoutProductId(params) ?? "invalid"}`} route={route} navigation={navigation} />;
}

