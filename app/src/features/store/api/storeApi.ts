import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  addFavorite,
  calculateProductPrice,
  convertPrice,
  createProductQuery,
  createProductQueryWaitV2,
  getFeaturedProducts,
  getPriceCalculator,
  getProductQueryStatus,
  getProductsBySection,
  getProductsBySectionDetail,
  getSections,
  getStoreProductsBySectionAdmin,
  getUserProductById,
  getUserProductRequirements,
  listFavorites,
  listUserPurchases,
  purchaseStoreProduct,
  removeFavorite,
  searchUserProducts,
  toggleFavorite,
} from "../../../api/store";

function apiResultFromLegacy<T>(response: T): ApiResult<T> {
  const legacyResponse = response as { ok?: boolean; error?: unknown; raw?: unknown };

  if (legacyResponse?.ok === false) {
    return apiFailure(legacyResponse.error ?? legacyResponse.raw ?? response);
  }

  return apiSuccess(response);
}

export type SectionsResponse = Awaited<ReturnType<typeof getSections>>;
export type ProductsBySectionResponse = Awaited<ReturnType<typeof getProductsBySection>>;
export type ProductsBySectionDetailResponse = Awaited<ReturnType<typeof getProductsBySectionDetail>>;
export type ProductDetailResponse = Awaited<ReturnType<typeof getUserProductById>>;
export type ProductRequirementsResponse = Awaited<ReturnType<typeof getUserProductRequirements>>;
export type ProductQueryResponse = Awaited<ReturnType<typeof createProductQuery>>;
export type ProductQueryWaitResponse = Awaited<ReturnType<typeof createProductQueryWaitV2>>;
export type ProductQueryStatusResponse = Awaited<ReturnType<typeof getProductQueryStatus>>;
export type FeaturedProductsResponse = Awaited<ReturnType<typeof getFeaturedProducts>>;
export type SearchProductsResponse = Awaited<ReturnType<typeof searchUserProducts>>;
export type FavoriteProductsResponse = Awaited<ReturnType<typeof listFavorites>>;
export type AddFavoriteProductResponse = Awaited<ReturnType<typeof addFavorite>>;
export type RemoveFavoriteProductResponse = Awaited<ReturnType<typeof removeFavorite>>;
export type ToggleFavoriteProductResponse = Awaited<ReturnType<typeof toggleFavorite>>;
export type CalculateProductPriceResponse = Awaited<ReturnType<typeof calculateProductPrice>>;
export type ConvertPriceResponse = Awaited<ReturnType<typeof convertPrice>>;
export type PurchaseStoreProductResponse = Awaited<ReturnType<typeof purchaseStoreProduct>>;
export type UserPurchasesResponse = Awaited<ReturnType<typeof listUserPurchases>>;
export type StoreProductsBySectionAdminResponse = Awaited<ReturnType<typeof getStoreProductsBySectionAdmin>>;
export type PriceCalculatorResponse = Awaited<ReturnType<typeof getPriceCalculator>>;

export async function getSectionsNormalized(
  params?: Parameters<typeof getSections>[0]
): Promise<ApiResult<SectionsResponse>> {
  try {
    return apiSuccess(await getSections(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProductsBySectionNormalized(
  sectionId: Parameters<typeof getProductsBySection>[0],
  params?: Parameters<typeof getProductsBySection>[1]
): Promise<ApiResult<ProductsBySectionResponse>> {
  try {
    return apiSuccess(await getProductsBySection(sectionId, params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProductsNormalized(
  sectionId: Parameters<typeof getProductsBySection>[0],
  params?: Parameters<typeof getProductsBySection>[1]
): Promise<ApiResult<ProductsBySectionResponse>> {
  return getProductsBySectionNormalized(sectionId, params);
}

export async function getProductsBySectionDetailNormalized(
  sectionId: Parameters<typeof getProductsBySectionDetail>[0]
): Promise<ApiResult<ProductsBySectionDetailResponse>> {
  try {
    return apiResultFromLegacy(await getProductsBySectionDetail(sectionId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProductDetailNormalized(
  productId: Parameters<typeof getUserProductById>[0]
): Promise<ApiResult<ProductDetailResponse>> {
  try {
    return apiSuccess(await getUserProductById(productId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProductRequirementsNormalized(
  productId: Parameters<typeof getUserProductRequirements>[0]
): Promise<ApiResult<ProductRequirementsResponse>> {
  try {
    return apiSuccess(await getUserProductRequirements(productId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function createProductQueryNormalized(
  productId: Parameters<typeof createProductQuery>[0],
  userInputs?: Parameters<typeof createProductQuery>[1]
): Promise<ApiResult<ProductQueryResponse>> {
  try {
    return apiResultFromLegacy(await createProductQuery(productId, userInputs));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function createProductQueryWaitNormalized(
  productId: Parameters<typeof createProductQueryWaitV2>[0],
  userInputs?: Parameters<typeof createProductQueryWaitV2>[1]
): Promise<ApiResult<ProductQueryWaitResponse>> {
  try {
    return apiResultFromLegacy(await createProductQueryWaitV2(productId, userInputs));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProductQueryStatusNormalized(
  productId: Parameters<typeof getProductQueryStatus>[0],
  localId: Parameters<typeof getProductQueryStatus>[1]
): Promise<ApiResult<ProductQueryStatusResponse>> {
  try {
    return apiResultFromLegacy(await getProductQueryStatus(productId, localId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getFeaturedProductsNormalized(): Promise<ApiResult<FeaturedProductsResponse>> {
  try {
    return apiSuccess(await getFeaturedProducts());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function searchProductsNormalized(
  params?: Parameters<typeof searchUserProducts>[0]
): Promise<ApiResult<SearchProductsResponse>> {
  try {
    return apiSuccess(await searchUserProducts(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getFavoriteProductsNormalized(): Promise<ApiResult<FavoriteProductsResponse>> {
  try {
    return apiSuccess(await listFavorites());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function addFavoriteProductNormalized(
  productId: Parameters<typeof addFavorite>[0]
): Promise<ApiResult<AddFavoriteProductResponse>> {
  try {
    return apiSuccess(await addFavorite(productId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function removeFavoriteProductNormalized(
  productId: Parameters<typeof removeFavorite>[0]
): Promise<ApiResult<RemoveFavoriteProductResponse>> {
  try {
    return apiSuccess(await removeFavorite(productId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function toggleFavoriteProductNormalized(
  productId: Parameters<typeof toggleFavorite>[0]
): Promise<ApiResult<ToggleFavoriteProductResponse>> {
  try {
    return apiSuccess(await toggleFavorite(productId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function calculateProductPriceNormalized(
  productId: Parameters<typeof calculateProductPrice>[0],
  params?: Parameters<typeof calculateProductPrice>[1]
): Promise<ApiResult<CalculateProductPriceResponse>> {
  try {
    return apiResultFromLegacy(await calculateProductPrice(productId, params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function convertPriceNormalized(
  amount: Parameters<typeof convertPrice>[0],
  fromCurrency: Parameters<typeof convertPrice>[1],
  toCurrency: Parameters<typeof convertPrice>[2]
): Promise<ApiResult<ConvertPriceResponse>> {
  try {
    return apiSuccess(await convertPrice(amount, fromCurrency, toCurrency));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function purchaseStoreProductNormalized(
  payload: Parameters<typeof purchaseStoreProduct>[0]
): Promise<ApiResult<PurchaseStoreProductResponse>> {
  try {
    return apiResultFromLegacy(await purchaseStoreProduct(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function listUserPurchasesNormalized(
  params?: Parameters<typeof listUserPurchases>[0]
): Promise<ApiResult<UserPurchasesResponse>> {
  try {
    return apiResultFromLegacy(await listUserPurchases(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getStoreProductsBySectionAdminNormalized(
  sectionId: Parameters<typeof getStoreProductsBySectionAdmin>[0]
): Promise<ApiResult<StoreProductsBySectionAdminResponse>> {
  try {
    return apiSuccess(await getStoreProductsBySectionAdmin(sectionId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPriceCalculatorNormalized(
  productId: Parameters<typeof getPriceCalculator>[0],
  params?: Parameters<typeof getPriceCalculator>[1]
): Promise<ApiResult<PriceCalculatorResponse>> {
  try {
    return apiResultFromLegacy(await getPriceCalculator(productId, params));
  } catch (error) {
    return apiFailure(error);
  }
}
