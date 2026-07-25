import OnboardingScreen from '../src/screens/OnboardingScreen';
import { useNavigationShim } from '../src/utils/navigation';

export default function OnboardingRoute() {
  const navigation = useNavigationShim();
  return <OnboardingScreen navigation={navigation} />;
}