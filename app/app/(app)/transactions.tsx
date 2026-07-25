import TransactionsList from "../../src/screens/transactions/TransactionsList";
import { useNavigationShim } from "../../src/utils/navigation";

export default function TransactionsScreen() {
  const navigation = useNavigationShim();
  return <TransactionsList navigation={navigation} />;
}
