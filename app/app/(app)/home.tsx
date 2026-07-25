import Home from "../../src/screens/Home";
import { useNavigationShim } from "../../src/utils/navigation";

export default function HomeScreen() {
  const navigation = useNavigationShim();

  return <Home navigation={navigation} />;
}

