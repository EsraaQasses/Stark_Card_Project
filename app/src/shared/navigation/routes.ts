export const ROOT_ROUTES = {
  Index: "/",
  FirstPage: "/first-page",
  Onboarding: "/onboarding",
} as const;

export const AUTH_ROUTES = {
  Login: "/(auth)/login",
  SignUp: "/(auth)/signup",
  SignUpEmail: "/(auth)/signup-email",
  SignUpPhone: "/(auth)/signup-phone",
  SignUpExtra: "/(auth)/signup-extra",
  Email: "/(auth)/signup-email",
  Phone: "/(auth)/signup-phone",
  Extra: "/(auth)/signup-extra",
  Verification: "/(auth)/verification",
  ForgetPassword: "/(auth)/forget-password",
  ResetPassword: "/(auth)/reset-password",
  LanguageSelect: "/(auth)/language-select",
  AuthOurAgents: "/(auth)/our-agents",
  AuthAgentQRConnect: "/(auth)/agent-qr-connect",
  Onboarding: ROOT_ROUTES.Onboarding,
  FirstPage: ROOT_ROUTES.FirstPage,
} as const;

export const APP_ROUTES = {
  Home: "/(app)/home",
  Menu: "/(app)/menu",
  Products: "/(app)/products",
  MyWallet: "/(app)/my-wallet",
  MyPayments: "/(app)/my-payments",
  MyOrders: "/(app)/my-orders",
  MyShippings: "/(app)/my-shippings",
  Downloads: "/(app)/downloads",
  WalletQR: "/(app)/wallet-qr",
  Profile: "/(app)/profile",
  Notifications: "/(app)/notifications",
  QRScanner: "/(app)/qr-scanner",
  AgentQRConnect: "/(app)/agent-qr-connect",
  MyQRCode: "/(app)/my-qr-code",
  PayToUser: "/(app)/pay-to-user",
  Payment: "/(app)/payment",
  NewTransfer: "/(app)/new-transfer",
  NewDeposit: "/(app)/new-deposit",
  TransactionsList: "/(app)/transactions",
  Transactions: "/(app)/transactions",
  Transfers: "/(app)/transfers",
  TakeMoney: "/(app)/take-money",
  TransactionDetail: "/(app)/transaction-detail",
  Favorite: "/(app)/favorite",
  MyFinancial: "/(app)/my-financial",
  ContactUs: "/(app)/contact-us",
  OurAgents: "/(app)/our-agents",
  AgentUsers: "/(app)/agent-users",
  AgentRequests: "/(app)/agent-requests",
  PaymentMethodsList: "/(app)/payment-methods",
  ShippingMethodInfo: "/(app)/shipping-method-info",
  ShippingMethodInfoDebug: "/(app)/shipping-method-info_debug",
  GenericPayment: "/(app)/generic-payment",
  ChooseAction: "/(app)/choose-action",
  SendStark: "/(app)/new-transfer",
  OrderDetail: "/(app)/transaction-detail",
} as const;

export const ROUTE_MAP = {
  ...ROOT_ROUTES,
  ...AUTH_ROUTES,
  ...APP_ROUTES,
} as const;

export const ROUTE_GROUPS = {
  Auth: "(auth)",
  App: "(app)",
} as const;

export const LEGACY_AUTH_PATHS = [
  "/login",
  "/signup",
  "/forget-password",
  "/reset-password",
] as const;

export const AUTH_REDIRECT_ROUTES = {
  AuthenticatedHome: APP_ROUTES.Home,
  UnauthenticatedLogin: AUTH_ROUTES.Login,
  FirstPage: ROOT_ROUTES.FirstPage,
} as const;

export const BOTTOM_NAV_ROUTE_MAP = {
  Home: APP_ROUTES.Home,
  Menu: APP_ROUTES.Menu,
  PaymentMethodsList: APP_ROUTES.PaymentMethodsList,
  ShippingMethodInfo: APP_ROUTES.ShippingMethodInfo,
  MyShippings: APP_ROUTES.MyShippings,
  OurAgents: APP_ROUTES.OurAgents,
  MyQRCode: APP_ROUTES.MyQRCode,
  NewTransfer: APP_ROUTES.NewTransfer,
  TakeMoney: APP_ROUTES.TakeMoney,
  Notifications: APP_ROUTES.Notifications,
  Profile: APP_ROUTES.Profile,
  AgentQRConnect: APP_ROUTES.AgentQRConnect,
} as const;

export const TAB_ROUTE_NAMES = new Set([
  "Home",
  "Menu",
  "PaymentMethodsList",
  "MyQRCode",
  "TransactionsList",
]);

export function normalizeRoutePath(path?: string | null) {
  if (!path) return "";

  const [pathWithoutQuery] = String(path).split("?");
  const withoutTrailingSlash =
    pathWithoutQuery.length > 1
      ? pathWithoutQuery.replace(/\/+$/, "")
      : pathWithoutQuery;

  return withoutTrailingSlash.replace(/^\/\((app|auth)\)/, "");
}

export function isSameRoutePath(currentPath?: string | null, targetPath?: string | null) {
  return normalizeRoutePath(currentPath) === normalizeRoutePath(targetPath);
}

export type RouteName = keyof typeof ROUTE_MAP;
export type RootRouteName = keyof typeof ROOT_ROUTES;
export type AppRouteName = keyof typeof APP_ROUTES;
export type AuthRouteName = keyof typeof AUTH_ROUTES;
