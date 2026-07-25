// src/api/qrcode.js
import api from "./client";

/**
 * Generate QR code for current user
 */
export async function generateMyQRCode() {
  try {
    const { data } = await api.post("qr_code/generate/");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * Get my QR code
 */
export async function getMyQRCode() {
  try {
    const { data } = await api.get("qr_code/my-qr/");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * Get user QR code by user ID (if authorized)
 */
export async function getUserQRCode(userId) {
  try {
    const { data } = await api.get(`qr_code/user/${userId}/qr/`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

function extractErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "فشل الطلب"
  );
}

export default {
  generateMyQRCode,
  getMyQRCode,
  getUserQRCode,
};
