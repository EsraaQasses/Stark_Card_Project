import { usePathname, useRouter } from "expo-router";
import { APP_ROUTES, isSameRoutePath, ROUTE_MAP, TAB_ROUTE_NAMES } from "../shared/navigation/routes";

/**
 * Centralized route mapping for the application.
 * Maps traditional screen names to Expo Router relative paths.
 */
export { ROUTE_MAP };

/**
 * Creates a navigation-like object that uses Expo Router internally.
 * Useful for compatibility with screens that expect a react-navigation 'navigation' prop.
 */
export function useNavigationShim() {
    const router = useRouter();
    const pathname = usePathname();

    const resolveRoute = (name) => {
        const mapped = ROUTE_MAP[name];
        // console.log(`[Shim] resolveRoute name=${name} mapped=${mapped} dev=${__DEV__}`);
        if (!mapped && !__DEV__) {
            // Log warning but allow navigation
            console.warn(`[Shim] Warning: Navigation to '${name}' not in ROUTE_MAP. using fallback.`);
        }
        return mapped || `/(app)/${name.toLowerCase()}`;
    };

    const safePush = (route, params, replace = false) => {
        // console.log(`[Shim] safePush route=${route} replace=${replace} params=`, params);
        if (!route) {
            router.back();
            return;
        }
        if (!params && isSameRoutePath(pathname, route)) {
            return;
        }
        if (params) {
            const payload = { pathname: route, params };
            return replace ? router.replace(payload) : router.push(payload);
        }
        return replace ? router.replace(route) : router.push(route);
    };

    return {
        navigate: (name, params) => {
            const route = resolveRoute(name);
            if (TAB_ROUTE_NAMES.has(name)) {
                safePush(route, params, true);
            } else {
                safePush(route, params, false);
            }
        },
        push: (name, params) => {
            const route = resolveRoute(name);
            safePush(route, params, false);
        },
        replace: (name, params) => {
            const route = resolveRoute(name);
            safePush(route, params, true);
        },
        goBack: () => router.back(),
        canGoBack: () => router.canGoBack(),
        setParams: (params) => {
            router.setParams(params);
        },
        reset: (options) => {
            const routeName = options?.routes?.[0]?.name || "Home";
            const route = ROUTE_MAP[routeName] || APP_ROUTES.Home;
            router.replace(route);
        },
        // Add additional react-navigation methods as needed
        dispatch: (action) => {
            // Limited support for dispatch
            if (action.type === 'REPLACE') {
                const route = ROUTE_MAP[action.payload.name] || `/(app)/${action.payload.name.toLowerCase()}`;
                router.replace({ pathname: route, params: action.payload.params });
            }
        }
    };
}
