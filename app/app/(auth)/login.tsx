import Login from '../../src/screens/Login';
import { useLocalSearchParams } from 'expo-router';
import { useNavigationShim } from '../../src/utils/navigation';

export default function LoginRoute() {
  const navigation = useNavigationShim();
  const params = useLocalSearchParams();

  return <Login navigation={navigation} onLoginSuccess={() => {}} route={{ params }} />;
}
