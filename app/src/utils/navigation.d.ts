import { useRouter, type Href } from "expo-router";

export type RouteName =
  | "Home"
  | "Menu"
  | "NewTransfer"
  | "MyQRCode"
  | "AgentQRConnect"
  | "PaymentMethodsList"
  | "OurAgents"
  | "Profile"
  | "Notifications"
  | "Verification"
  | "NewDeposit"
  | "TransactionsList"
  | "Transfers"
  | "TakeMoney"
  | "MyWallet"
  | "MyShippings"
  | "WalletQR"
  | "Payment"
  | "ShippingMethodInfo"
  | "Login"
  | "SignUp"
  | "SignUpExtra";

const routeMap: Record<RouteName, Href> = {
  Home: "/(app)/home",
  Menu: "/(app)/menu",
  NewTransfer: "/(app)/new-transfer",
  MyQRCode: "/(app)/my-qr-code",
  AgentQRConnect: "/(app)/agent-qr-connect",
  PaymentMethodsList: "/(app)/payment-methods",
  OurAgents: "/(app)/our-agents",

  Profile: "/(app)/profile",
  Notifications: "/(app)/notifications",

  NewDeposit: "/(app)/new-deposit",
  TransactionsList: "/(app)/transactions",
  Transfers: "/(app)/transfers",
  TakeMoney: "/(app)/take-money",
  MyWallet: "/(app)/my-wallet",
  MyShippings: "/(app)/my-shippings",
  WalletQR: "/(app)/wallet-qr",
  Payment: "/(app)/payment",
  ShippingMethodInfo: "/(app)/shipping-method-info",

  // auth
  Login: "/(auth)/login",
  SignUp: "/(auth)/signup",
  SignUpExtra: "/(auth)/signup-extra",
  Verification: "/(auth)/verification",
};

export type NavigationShim = {
  navigate: (name: RouteName, params?: Record<string, any>) => void;
  goBack: () => void;
};

export function useNavigationShim(): NavigationShim {
  const router = useRouter();

  return {
    navigate: (name, params) => {
      const pathname = routeMap[name];
      if (params) router.push({ pathname, params } as any);
      else router.push(pathname);
    },
    goBack: () => router.back(),
  };
}
