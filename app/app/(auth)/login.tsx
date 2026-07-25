import Login from '../../src/screens/Login';
import { useNavigationShim } from '../../src/utils/navigation';

export default function LoginRoute() {
  const navigation = useNavigationShim();

  return <Login navigation={navigation} />;
}
