// ===== Static Route Map (outside component) =====
const ROUTE_MAP = {
    Home: "/(app)/home",
    Menu: "/(app)/menu",
    PaymentMethodsList: "/(app)/payment-methods",
    ShippingMethodInfo: "/(app)/shipping-method-info",
    MyShippings: "/(app)/my-shippings",
    OurAgents: "/(app)/our-agents",
    MyQRCode: "/(app)/my-qr-code",
    NewTransfer: "/(app)/new-transfer",
    TakeMoney: "/(app)/take-money",
    Notifications: "/(app)/notifications",
    Profile: "/(app)/profile",
    AgentQRConnect: "/(app)/agent-qr-connect",
};

// Inside your component:
export default function YourComponent() {
    const router = useRouter();

    // ===== Navigation Lock =====
    const navigationLockRef = useRef(false);

    // ===== Safe Navigate Function =====
    const safeNavigate = useCallback(
        (name, params) => {
            console.log("[safeNavigate] name=", JSON.stringify(name));

            // ✅ Navigation lock - prevent double navigation
            if (navigationLockRef.current) {
                console.warn("[safeNavigate] Navigation locked, ignoring duplicate call");
                return;
            }

            // ✅ Guard: Route must exist in ROUTE_MAP
            const route = ROUTE_MAP[name];
            if (!route) {
                console.warn("[safeNavigate] Route not found for name=", JSON.stringify(name));
                return;
            }

            console.log("[safeNavigate] NAV ->", JSON.stringify(name), "route=", route, "params=", params);

            // ✅ Lock navigation
            navigationLockRef.current = true;

            try {
                router.push(params ? { pathname: route, params } : route);
            } finally {
                // ✅ Unlock after a short delay
                setTimeout(() => {
                    navigationLockRef.current = false;
                }, 500);
            }
        },
        [router]
    );

    // Usage examples:
    // safeNavigate("Home")
    // safeNavigate("ShippingMethodInfo", { methodId: 123 })
    // safeNavigate("OurAgents", { public: true, mode: "assign" })
}
