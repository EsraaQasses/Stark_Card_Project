# Architecture Foundation

## Current Migration Goal

The current goal is to create a feature-based architecture foundation without changing runtime behavior. Existing screens, route files, route URLs, API modules, and navigation compatibility layers remain in place while new code gets clear targets for gradual migration.

## Target Feature-Based Architecture

Feature-owned code should live under `src/features/<feature>`:

- `api`: feature-specific API adapters and response normalization.
- `hooks`: feature-specific UI/data hooks.
- `model`: pure business rules, formatters, validators, mappers, and types.
- `screens`: future feature screen implementations.
- `components`: feature-only UI components.
- `utils`: feature-only utilities.

Current feature roots are `auth`, `wallet`, `payments`, `store`, `transactions`, `agents`, `profile`, and `notifications`.

## Shared Code

Reusable cross-feature code should live under `src/shared`:

- `api`: shared API compatibility, error normalization, and later client utilities.
- `storage`: storage keys and storage wrappers.
- `navigation`: route constants and future navigation helpers.
- `theme`: shared design tokens for colors, spacing, radius, typography, shadows, and layout constants.
- `ui`, `layout`, `feedback`, `forms`: shared presentation components.
- `hooks`, `utils`, `constants`, `types`: cross-feature primitives.

## Theme Foundation

- Shared theme tokens live under `src/shared/theme`.
- `src/ui/Theme.js` remains the compatibility layer for existing imports and must keep its legacy default export shape.
- Future UI work should use shared theme tokens instead of adding new one-off color, radius, spacing, typography, or shadow constants.
- Default typography is system/WhatsApp-like. Shared typography tokens leave `fontFamily` undefined so React Native uses the platform system font: Android Roboto/system and iOS San Francisco/system.
- Almarai font files remain available under `assets/fonts` and may still be loaded by the root Expo layout temporarily, but Almarai is optional and is not the default visual font.
- Optional custom font names live under `customFontFamilies.almarai` and `fontFamilies.almarai*` for future deliberate use.
- Existing raw React Native `Text` usage is not mass-edited. Future UI work should prefer shared typography tokens while preserving the system-font default.
- Arabic/RTL support is a foundation requirement for every UI pass. Shared RTL helpers live under `src/shared/utils/rtl.js`; do not add new one-off `I18nManager` patterns when a shared helper fits.
- Responsive sizing should reuse `src/ui/scale.js` helpers (`sx`, `sy`, `s`, `sp`, `ms`, `rsp`, `useScale`) and shared spacing/layout tokens instead of introducing one-off screen-specific scaling systems.
- `CornerSpinner` is an app identity element. `PageLayout` supports an opt-in `showCornerSpinner` prop for future layout-level adoption, but existing manual screen usage should be migrated gradually to avoid duplicate spinners.
- Shared UI page/header primitives live under `src/shared/ui`. New UI work should prefer `AppHeader`, `AppPage`, and small primitives such as `AppCard`, `AppIconButton`, `AppSectionTitle`, `AppEmptyState`, and `AppSearchBox` instead of adding new one-off header, card, icon button, empty state, or search styles.
- Shared UI primitives use system typography, RTL helpers, theme tokens, and responsive helpers. They are intended for screen-by-screen adoption, not broad mass replacement.
- Shared UI primitives are the first place to fix RTL consistency for headers, search inputs, section titles, empty states, and action rows.
- Screen-by-screen Arabic QA is required for visible English text, mixed LTR/RTL rows, icon/text ordering, search input alignment, number/currency direction, and corrupted Arabic text.
- Screen redesigns should happen one screen at a time after behavior is covered.
- Payment submit, auth boot redirect, and wallet currency mutation screens are sensitive areas and should not be the first broad visual redesign targets.

## Rules For New Code

- Put feature behavior in the owning feature folder.
- Put cross-feature behavior in `src/shared`.
- Keep route files thin and preserve Expo Router URLs.
- Do not add direct `AsyncStorage` usage inside new screens; use shared storage boundaries.
- Do not read or write auth/session tokens directly; use `src/shared/storage/authStorage.ts`.
- Do not add new route maps; use `src/shared/navigation/routes.ts`.
- Treat Expo Router files in `app` as the source of route URL availability.
- Treat `src/shared/navigation/routes.ts` as the source of route path constants.
- New navigation code should use shared route constants instead of direct route strings when a constant exists.
- Do not add `useNavigationShim` to new code; it remains a legacy compatibility layer for migrated screens.
- Bottom navigation route changes should go through `BOTTOM_NAV_ROUTE_MAP`.
- New API modules should return `ApiResult<T>` from `src/shared/api/apiResult.ts`.
- API modules should normalize expected errors through `normalizeApiError`.
- Screens should not depend on raw Axios response shape.
- Agent API calls should go through `src/features/agents/api/agentsApi.ts`.
- New agent API functions should return `ApiResult<T>`.
- Legacy agent exports remain compatible during gradual migration.
- Notification API calls should go through `src/features/notifications/api/notificationsApi.ts`.
- New notification API functions should return `ApiResult<T>`.
- UI components should not depend on raw notification Axios response shapes.
- Notification polling and cache extraction is a later dedicated phase.
- Legacy notification/system exports remain compatible during gradual migration.
- Profile/current-user API calls should go through `src/features/profile/api/profileApi.ts`.
- New profile API functions should return `ApiResult<T>`.
- Store/product API calls should go through `src/features/store/api/storeApi.ts`.
- New store/product API functions should return `ApiResult<T>`.
- Legacy store exports remain compatible during gradual migration.
- Store screens should keep UI state, rendering, navigation, cache reads/writes, storage side effects, and API side effects only.
- Store business rules such as product normalization, section tree lookup, and filtering should live in `src/features/store/model`.
- Store formatting and display helpers should live in `src/features/store/utils`.
- Store hooks may own data orchestration when they preserve existing fetch order, cache keys, cache TTLs, loading behavior, and response shapes.
- Store data hooks should prefer `src/features/store/api/storeApi.ts` when the normalized wrapper returns the exact legacy data shape under `ApiResult.data`.
- Store `ApiResult` unwrapping must preserve the screen's existing data shape and should preserve prior fallback/error behavior.
- Store pricing display orchestration can live in `src/features/store/hooks` when it preserves synchronous `displayPrice` behavior and does not introduce async pricing APIs.
- Store screens should keep UI rendering and navigation payload construction unless a later migration explicitly scopes those changes.
- Product list screens should keep price fallback rendering in the screen until a later UI/component extraction is explicitly scoped.
- Store cache extraction is a later dedicated phase and must preserve existing keys, TTLs, fetch order, loading behavior, and cached response shapes.
- Store cache behavior should be snapshotted before API-boundary migrations: key, TTL, cache-first order, API-second order, and write-after-API order.
- Full store API migration to `src/features/store/api` is a later phase unless the legacy behavior is proven identical.
- Async price calculators such as `calculateProductPrice`, `convertPrice`, and `getPriceCalculator` are not part of product-list display pricing unless a later migration explicitly scopes that change.
- Wallet API calls should go through `src/features/wallet/api/walletApi.ts`.
- Wallet API mutations should go through `src/features/wallet/api/walletApi.ts`.
- New wallet API functions should return `ApiResult<T>`.
- Wallet hooks may own wallet data orchestration when the migration is explicitly scoped and behavior can be preserved exactly.
- Wallet screens should keep UI layout, navigation, alerts, animations, and rendering-specific state until a later orchestration hook migration.
- Wallet optimistic UI migrations must preserve rollback behavior and user-facing messages.
- Wallet business rules should live in `src/features/wallet/model`.
- Wallet formatting and display helpers should live in `src/features/wallet/utils`.
- Wallet cache and polling migrations must preserve existing storage keys, fetch order, loading/error behavior, and polling intervals.
- Full wallet cache redesign is a later dedicated phase.
- Wallet cache and polling logic should not be added directly to new UI components going forward.
- Payment-method API calls should go through `src/features/payments/api/paymentMethodsApi.ts`.
- New payment-method API functions should return `ApiResult<T>`.
- Payment screens should keep UI state, rendering, and side effects only.
- Payment business rules should live in `src/features/payments/model`.
- Payment formatting and display helpers should live in `src/features/payments/utils`.
- Payment hooks should contain derived state and orchestration around pure payment helpers.
- Payment hooks must not contain navigation, alerts, storage side effects, or submit side effects unless explicitly approved in a later migration.
- Payment submit flow extraction is a later dedicated phase.
- Payment API calls should gradually move behind `src/features/payments/api`.
- Transaction API calls should go through `src/features/transactions/api/transactionsApi.ts`.
- New transaction API functions should return `ApiResult<T>`.
- Screens should not depend on raw transaction Axios response shapes.
- Legacy transaction exports remain compatible during gradual migration.
- Do not add a new API return contract without normalizing it at the feature API boundary.
- Keep pure logic out of components when it can live in `model`.

## API Result Boundary

- Feature API modules should expose normalized functions that return `ApiResult<T>`.
- Expected API failures should return `{ ok: false, error }` instead of forcing screens to inspect Axios errors.
- Legacy API modules under `src/api` remain compatible until each feature is migrated.
- Existing throwing functions may stay in place where screens already depend on their exact error behavior.
- Legacy profile/current-user exports such as `getMe` remain compatible while new code uses the profile feature boundary.
- Legacy wallet/payment/store exports remain compatible while new wallet code uses the wallet feature boundary.
- Legacy payment-method exports remain compatible while new payment-method code uses the payments feature boundary.
- Legacy transaction exports remain compatible while new transaction code uses the transactions feature boundary.

## Auth And Storage Boundary

- Auth tokens and compatible session records are centralized in `src/shared/storage/authStorage.ts`.
- The current storage backend remains AsyncStorage for behavior compatibility.
- Token/session keys are centralized in `src/shared/storage/storageKeys.ts`.
- Existing non-auth storage such as wallet caches, favorites, onboarding, language, currency, and notification state should migrate gradually through feature-specific storage helpers.
- Sensitive token storage should move from AsyncStorage to `expo-secure-store` in a later dedicated security migration.

## Navigation Boundary

- Route URLs are owned by Expo Router route files under `app`.
- Shared route constants live in `src/shared/navigation/routes.ts` and mirror existing route URLs without changing them.
- `src/utils/navigation.js` and `useNavigationShim` remain compatible for screens that still expect React Navigation-style APIs.
- New code should not introduce duplicate route maps inside screens, utility modules, or UI components.
- New tab or bottom navigation destinations should be added to `BOTTOM_NAV_ROUTE_MAP` instead of local maps.
- Root redirects and auth redirects should reference shared route constants when behavior can remain identical.
- Legacy direct navigation calls inside screens can remain until each screen is migrated deliberately.

## Layout Boundary

- Route files should stay thin and should not accumulate feature business logic.
- Existing layout wrappers such as `PageLayout`, `Screen`, `Screenn`, `WithNav`, direct `NavBar`, and direct `BottomNav` usage remain compatible during migration.
- `src/shared/ui/layout/AppScreen.tsx` is the future target wrapper, but existing screens should not be converted until behavior is covered and the migration is scoped.
- New screen layout code should avoid adding another competing wrapper unless there is a clear feature-specific reason.

## What Should Not Move Yet

- Do not move `Payment.js`, `Products.js`, `MyWallet.js`, `BottomNav.js`, AuthProvider files, or route files in the foundation phase.
- Do not remove `useNavigationShim`.
- Do not switch auth token storage to `expo-secure-store` yet.
- Do not rewrite API modules or change interceptors yet.
- Do not replace existing layouts yet.

## Non-Functional Requirements Supported

- Maintainability: new code has feature ownership and shared boundaries.
- Scalability: features can migrate independently.
- Testability: pure model logic can be extracted and tested without rendering screens.
- Performance: future data hooks can centralize caching, polling, and memoization.
- Security: auth storage has a boundary for a later secure-store migration.
- Reliability: API errors can be normalized consistently.
- Consistency: routes and storage keys have canonical constants.

## Migration Order

1. Keep route URLs and screen behavior frozen.
2. Centralize route constants and storage keys.
3. Extract auth storage calls behind `authStorage`.
4. Add normalized `ApiResult<T>` feature API boundaries.
5. Normalize API errors at the shared helper level.
6. For each feature, extract pure model functions from screens.
7. Extract feature API adapters and hooks.
8. Move small feature components after behavior is covered.
9. Replace direct screen storage/API usage with feature hooks.
10. Standardize layout and feedback components.
11. Remove legacy compatibility only after all call sites are migrated.
