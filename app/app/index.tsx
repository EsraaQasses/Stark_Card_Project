import { Redirect } from 'expo-router';
import { ROOT_ROUTES } from '../src/shared/navigation/routes';

export default function Index() {
  return <Redirect href={ROOT_ROUTES.FirstPage} />;
}
