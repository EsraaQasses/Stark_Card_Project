import MyWallet from "../../src/screens/MyWallet";
import { useNavigationShim } from "../../src/utils/navigation";

export default function MyWalletScreen() {
  const navigation = useNavigationShim();
  return <MyWallet navigation={navigation} />;
}