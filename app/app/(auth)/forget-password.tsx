import ForgetPassword from '../../src/screens/SignUp/ForgetPassword';
import { useNavigationShim } from '../../src/utils/navigation';

export default function ForgetPasswordRoute() {
  const navigation = useNavigationShim();
  return <ForgetPassword navigation={navigation} />;
}