// src/utils/polling.js

/**
 * إدارة polling للبيانات المتحدثة بشكل دوري
 * مثل: تحديث رصيد المحفظة، حالة الطلبات، إلخ
 */

class PollingManager {
  constructor() {
    this.intervals = {};
  }

  /**
   * بدء polling عملية معينة
   * @param {string} key - معرّف فريد للعملية
   * @param {Function} callback - الدالة التي تُستدعى كل فترة
   * @param {number} intervalMs - الفترة بالميلي ثانية (افتراضي: 10 ثواني)
   */
  start(key, callback, intervalMs = 10000) {
    // إذا كانت عملية موجودة بنفس الـ key، أوقفها أولاً
    if (this.intervals[key]) {
      clearInterval(this.intervals[key]);
    }

    // استدعاء الـ callback فوراً عند البدء
    callback();

    // ثم ابدأ الـ polling
    this.intervals[key] = setInterval(callback, intervalMs);
  }

  /**
   * إيقاف polling عملية معينة
   */
  stop(key) {
    if (this.intervals[key]) {
      clearInterval(this.intervals[key]);
      delete this.intervals[key];
    }
  }

  /**
   * إيقاف جميع عمليات الـ polling
   */
  stopAll() {
    Object.keys(this.intervals).forEach((key) => this.stop(key));
  }

  /**
   * التحقق من أن عملية ما تعمل
   */
  isRunning(key) {
    return !!this.intervals[key];
  }
}

// إنشاء instance واحد لاستخدامه في التطبيق
export const pollingManager = new PollingManager();

/**
 * Hook بسيط لاستخدام polling في React components
 */
export function usePolling(key, callback, intervalMs = 10000, deps = []) {
  const React = require("react");

  React.useEffect(() => {
    pollingManager.start(key, callback, intervalMs);

    return () => {
      pollingManager.stop(key);
    };
  }, [key, callback, intervalMs, deps]);
}

/**
 * Polling manager منفصل للـ wallet data
 * يتابع تحديث الرصيد بشكل آمن
 */
export class WalletPolling {
  constructor() {
    this.callback = null;
    this.isRunning = false;
    this.interval = null;
    this.intervalMs = 15000; // كل 15 ثانية
  }

  /**
   * بدء الـ polling
   */
  start(callback, intervalMs = 15000) {
    this.callback = callback;
    this.intervalMs = intervalMs;

    if (this.isRunning) return; // بالفعل يعمل

    // استدعاء فوري
    if (callback) callback();

    this.interval = setInterval(() => {
      if (callback) callback();
    }, this.intervalMs);

    this.isRunning = true;
  }

  /**
   * إيقاف الـ polling
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.isRunning = false;
    this.callback = null;
  }

  /**
   * تحديث الـ interval بدون إعادة تشغيل
   */
  setInterval(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.isRunning) {
      this.stop();
      this.start(this.callback, intervalMs);
    }
  }
}

/**
 * Debounce function - تأخير تنفيذ دالة حتى تتوقف الـ calls
 * مفيدة للـ search أو auto-save
 */
export function debounce(func, delayMs = 500) {
  let timeoutId = null;

  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func(...args);
    }, delayMs);
  };
}

/**
 * Throttle function - تنفيذ دالة كل X ميلي ثانية كحد أقصى
 * مفيدة للـ scroll events أو resize
 */
export function throttle(func, delayMs = 300) {
  let lastCallTime = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= delayMs) {
      func(...args);
      lastCallTime = now;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastCallTime = Date.now();
        },
        delayMs - timeSinceLastCall,
      );
    }
  };
}

export default {
  pollingManager,
  usePolling,
  WalletPolling,
  debounce,
  throttle,
};
