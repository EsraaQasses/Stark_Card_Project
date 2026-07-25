import Profile from "../../src/screens/Profile";
import { useNavigationShim } from "../../src/utils/navigation";

export default function ProfileScreen() {
  const navigation = useNavigationShim();
  return <Profile navigation={navigation} />;
}