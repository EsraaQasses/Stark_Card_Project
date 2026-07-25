import ResetPassword from '../../src/screens/SignUp/ResetPassword';
import { useLocalSearchParams } from 'expo-router';
import { useNavigationShim } from '../../src/utils/navigation';

export default function ResetPasswordRoute() {
  const navigation = useNavigationShim();
  const params = useLocalSearchParams();

  return <ResetPassword navigation={navigation} route={{ params }} />;
}
