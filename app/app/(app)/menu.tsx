import Menu from "../../src/screens/Menu";
import { useNavigationShim } from "../../src/utils/navigation";

export default function MenuScreen() {
  const navigation = useNavigationShim();

  return <Menu navigation={navigation} />;
}

