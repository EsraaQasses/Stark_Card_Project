import Notifications from "../../src/screens/Notifications";
import { useNavigationShim } from "../../src/utils/navigation";

export default function NotificationsScreen() {
  const navigation = useNavigationShim();
  return <Notifications navigation={navigation} />;
}