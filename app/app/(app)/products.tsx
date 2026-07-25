import Products from "../../src/screens/Products";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function ProductsScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigationShim();

  // Create route-like object for compatibility
  const route = {
    params: params || {},
  };

  return <Products route={route} navigation={navigation} />;
}

