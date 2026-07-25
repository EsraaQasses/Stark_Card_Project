import TransactionDetail from "../../src/screens/transactions/TransactionDetail";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigationShim();

  const route = {
    params: params || {},
  };

  return <TransactionDetail route={route} navigation={navigation} />;
}

