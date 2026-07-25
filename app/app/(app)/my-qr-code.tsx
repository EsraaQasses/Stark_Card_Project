import MyQRCode from "../../src/screens/MyQRCode";
import { useNavigationShim } from "../../src/utils/navigation";

export default function MyQRCodeScreen() {
  const navigation = useNavigationShim();
  return <MyQRCode navigation={navigation} />;
}
