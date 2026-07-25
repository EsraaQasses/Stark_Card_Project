import React from "react";
import PaymentMethodsList from "../../src/screens/payments/PaymentMethodsList";
import { useLocalSearchParams } from "expo-router";
import { useNavigationShim } from "../../src/utils/navigation";

export default function PaymentMethodsScreen() {
  const navigation = useNavigationShim();
  const params = useLocalSearchParams();

  return <PaymentMethodsList navigation={navigation} route={{ params }} />;
}
