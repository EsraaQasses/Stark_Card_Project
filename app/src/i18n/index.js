// /src/i18n/index.js
import i18n, { changeLanguage, use as i18nUse } from "i18next";
import { initReactI18next } from "react-i18next";

// ---- Arabic ----
const ar = {
  auth: {
    loginTitle: "أهلاً بعودتك",
    loginSubtitle: "سجّل الدخول للمتابعة",
    identifier: "البريد أو اسم المستخدم",
    identifierPh: "example@mail.com",
    password: "كلمة المرور",
    passwordPh: "اكتب كلمة المرور",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    show: "إظهار",
    hide: "إخفاء",
    forgotPassword: "نسيت كلمة المرور؟",
    signIn: "تسجيل الدخول",
    noAccount: "ما عندك حساب؟",
    createAccount: "أنشئ حساباً",
    loginErrorGeneric: "فشل تسجيل الدخول. تأكد من البيانات.",
  },

  common: {
    appName: "ستارك",
    required: "مطلوب",
    done: "تم",
    error: "خطأ",
    ok: "حسناً",
    cancel: "إلغاء",
    save: "حفظ",
    close: "إغلاق",
    approve: "تأكيد",
    delete: "حذف",
    back: "رجوع",
    search: "بحث",
    system: "نظام",
    general: "عام",
    unread: "غير مقروء",
    all: "الكل",
    markAllRead: "تحديد الكل كمقروء",
    markRead: "تحديد كمقروء",
    markUnread: "تحديد كغير مقروء",
    noNotifications: "لا توجد إشعارات",
    caughtUp: "أنت على اطلاع كامل، ستظهر التحديثات الجديدة هنا.",
    showAll: "عرض الكل",
    noItems: "لا توجد عناصر.",
    noSections: "لا يوجد أقسام متاحة.",
    loading: "جاري التحميل…",
    networkError: "خطأ في الشبكة",
    tryAgain: "أعد المحاولة",
    itemsCount_singular: "{{count}} منتج",
    itemsCount_plural: "{{count}} منتجات",
    signInRequiredTitle: "تسجيل الدخول مطلوب",
    signInRequiredBody: "يرجى تسجيل الدخول لاستخدام المفضلة.",
  },

  home: {
    headerNotificationsAlt: "الإشعارات",
    headerProfileAlt: "الملف الشخصي",
    section: "قسم {{n}}",
    searchPlaceholder: "ابحث عن قسم",
  },

  products: {
    title: "المنتجات",
    pageTitleFor: "صفحة المنتجات لـ {{title}}",
    chooseSection: "اختر القسم",
    subsectionLabel: "قسم فرعي",
    searchPlaceholder: "ابحث داخل المنتجات…",
    productsCount_singular: "{{count}} منتج",
    productsCount_plural: "{{count}} منتجات",
    emptyInRoot: "لا توجد عناصر ضمن هذا القسم.",
    chooseQty: "الكمية (أدنى {{min}}، أعلى {{max}})",
    productFallback: "المنتج",
    finalPriceNote: "يُثبت السعر النهائي على الخادم.",
    pickPackBody: "يرجى اختيار باقة قبل الدفع.",
    missingProductTitle: "بيانات المنتج ناقصة",
    missingProductBody: "تعذّر تحديد المنتج. حاول مجددًا.",
    successTitle: "تم الدفع بنجاح ✅",
    successBody: "تمت العملية بنجاح.",
    updateFavFailed: "تعذّر تحديث المفضلة.",
  },

  // ========= NEW: MyPayments (plural) =========
  payments: {
    title: "مدفوعاتي",
    subtitle: "أحدث عمليات الشراء والمعاملات الخاصة بك.",
    total: "الإجمالي",
    success: "ناجحة",
    pending: "قيد الانتظار",
    failed: "فاشلة",
    processing: "جارٍ المعالجة",
    cancelled: "ملغاة",

    filter: {
      all: "الكل",
      success: "ناجحة",
      pending: "قيد الانتظار",
      processing: "جارٍ المعالجة",
      failed: "فاشلة",
      cancelled: "ملغاة",
    },

    status: {
      success: "ناجحة",
      pending: "قيد الانتظار",
      processing: "جارٍ المعالجة",
      failed: "فاشلة",
      cancelled: "ملغاة",
    },

    emptyTitle: "لا توجد مدفوعات بعد",
    emptyHint: "ستظهر مدفوعاتك هنا لاحقًا.",
    emptyFiltered: "لا توجد مدفوعات بهذه الحالة.",

    loadMore: "تحميل المزيد",
    noMore: "لا مزيد من النتائج",
    exploreProducts: "استكشف المنتجات",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",

    details: "تفاصيل",
    kv: {
      id: "المعرّف",
      productId: "معرّف المنتج",
      base: "الأساس",
      profit: "نسبة الربح",
    },
  },

  payment: {
    title: "الدفع",
    gamerId: "معرّف اللاعب",
    enterYourId: "أدخل المعرّف",
    selectWalletFirst: "يرجى اختيار المحفظة للدفع أولاً.",
    approve: "تأكيد",
    cancel: "إلغاء",
    price: "السعر",
    pricing: "عملية الشراء",
    currency: "العملة",
    unit: "سعر الوحدة",
    total: "الإجمالي",
    finalPriceNote: "يُثبت السعر النهائي على الخادم.",
    pickPack: "اختر باقة",
    confirmPay: "تأكيد والدفع",
    paying: "جارٍ الدفع...",
    productFallback: "المنتج",
    pickPackBody: "يرجى اختيار باقة قبل الدفع.",
    missingProductTitle: "بيانات المنتج ناقصة",
    missingProductBody: "تعذّر تحديد المنتج. حاول مجددًا.",
    successTitle: "تم الدفع بنجاح ✅",
    successBody: "تمت العملية بنجاح.",
    updateFavFailed: "تعذّر تحديث المفضلة.",
  },

  nav: {
    send_pop_title1: "ستارك إلى ستارك",
    send_pop_sub1: "تحويل فوري",
    send_pop_title2: "سحب أموال",
    send_pop_sub2: "نقدًا / عبر وكيل",
    dl_whish_money: "ويش موني",
    dl_cash: "نقدًا",
    dl_usdt_trc20: "USDT‏ TRC20",
    dl_binance_id: "Binance Pay ID",
  },

  notifications: {
    title: "الإشعارات",
    paymentReceived: "تم استلام دفعة",
    orderPacked: "تم تجهيز الطلب",
    updateAvailable: "تحديث متاح",
  },

  paymentMethods: {
    title: "طرق الدفع",
    subtitle: "اختر وسيلة الدفع للمتابعة",
    searchPlaceholder: "ابحث عن وسيلة الدفع…",
    loadError: "تعذّر تحميل وسائل الدفع. يرجى تسجيل الدخول والتحقق من الاتصال.",
    emptyTitle: "لا توجد وسائل دفع متاحة حالياً.",
    emptyBody: "ستظهر هنا تلقائياً عند إضافتها من الأدمن.",
    open: "فتح",
  },

  paymentsList: {
    subtitle: "آخر عمليات الإيداع/التحويل/الشراء المرتبطة بحسابك.",
    empty: "لا توجد معاملات حتى الآن.",
    fields: {
      processId: "رقم العملية",
      total: "الإجمالي",
      value: "القيمة",
      date: "التاريخ",
    },
    status: {
      pending: "قيد المراجعة",
      rejected: "مرفوض",
    },
  },

  notificationsScreen: {
    deleteTitle: "حذف الإشعار",
    deleteBody: "متأكد من الحذف؟",
  },

  agents: {
    clients: "عملاء",
    commission: "عمولة",
    products: "منتجات",
    details: "تفاصيل",
    hide: "إخفاء",
    noResults: "لا يوجد وكلاء مطابقون لبحثك.",
  },

  currency: {
    SYP: "ل.س",
    usd: "دولار",
  },

  wallet: {
    title: "محفظتي",
    lastRefreshHint: "آخر تحديث للتو — اسحب للتحديث",
    chooseNow: "اختر المحفظة الآن",
    exchange: {
      title: "سعر الصرف",
      usdToSyp: "1 دولار = {{value}} ل.س",
      sypToUsd: "1 ل.س = {{value}} دولار",
    },
    balances: {
      usd: "رصيد الدولار",
      syp: "رصيد الليرة",
    },
    totals: {
      usd: "الإجمالي (دولار)",
      syp: "الإجمالي (ل.س)",
    },
    filters: {
      from: "من",
      to: "إلى",
    },
    categories: {
      orders: "الطلبات",
      charging: "الشحن",
    },
    actions: {
      charge: "شحن",
      withdraw: "سحب",
      soon: "قريبًا",
    },
    totalLine: "الإجمالي: {{usd}} دولار / {{syp}} ل.س",
    empty: {
      body: "لا يوجد معاملات للعرض حاليًا.\nأضِف لاحقًا Endpoint لعرض التفاصيل هنا.",
    },
    alerts: {
      currencyChanged: {
        title: "تم",
        body: "تم تعيين العملة الافتراضية إلى {{currency}}",
      },
    },
    errors: {
      load: "تعذّر تحميل بيانات المحفظة. تحقّق من الاتصال أو الصلاحيات.",
      changeCurrency: "تعذّر تغيير العملة.",
    },
  },

  menu: {
    myProfile: "ملفي الشخصي",
    myPayments: "مدفوعاتي",
    myWallet: "محفظتي",
    myOrders: "طلباتي",
    favorite: "المفضلة",
    myFinancial: "\u0645\u0644\u062e\u0635\u064a \u0627\u0644\u0645\u0627\u0644\u064a",
    ourAgents: "وكلاؤنا",
    contactUs: "تواصل معنا",
    logout: "تسجيل الخروج",
    userName: "اسم المستخدم",
    logoutTitle: "تسجيل الخروج",
    logoutBody: "هل أنت متأكد أنك تريد تسجيل الخروج؟",
    // --- قسم الوكلاء (جديد) ---
    agentSection: "قسم الوكلاء",
    agentClients: "عملائي",
    agentRequests: "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0648\u0643\u064a\u0644",
    agentApprovals: "طلبات بانتظار الموافقة",
  },

  profile: {
    title: "ملفي الشخصي",
    firstName: "الاسم الأول",
    lastName: "الكنية",
    email: "البريد الإلكتروني",
    userName: "اسم المستخدم",
    phone: "رقم الهاتف",
    country: "البلد",
    optionalPhone: "رقم بديل",
    connectedAgent: "الوكيل المرتبط",
    agentCode: "الرمز",
    walletBalances: "أرصدة المحفظة",
    darkMode: "الوضع الداكن",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    viewOnly: "عرض فقط",
    editing: "تحرير…",
    copy: "نسخ",
    copied: "تم النسخ إلى الحافظة",
    notSupported: "حفظ الملف الشخصي غير مفعّل بعد.\nواجهة ‘/users/me/’ للقراءة فقط.",
    invalidEmail: "رجاءً أدخل بريدًا إلكترونيًا صالحًا.",
    invalidPhone: "رجاءً أدخل رقم هاتف صالحًا.",
  },

  // Transfers (used by NewTransfer)
  transfer: {
    title: "تحويل Stark إلى Stark",
    subtitle: "أرسل رصيدك مباشرة إلى محفظة Stark أخرى",
    senderWallet: "رقم محفظة المرسل",
    senderPlaceholder: "مثال: 12",
    recipientWallet: "رقم محفظة المستلم",
    recipientPlaceholder: "مثال: 34",
    amount: "المبلغ",
    noteOpt: "ملاحظة (اختياري)",
    notePlaceholder: "اكتب ملاحظة قصيرة…",
    sendBtn: "إرسال التحويل",
    sending: "جارٍ الإرسال...",
    helper: "سيتم التحقق من الرصيد وصحة أرقام المحافظ قبل التنفيذ.",
    fillAll: "أدخل جميع الحقول بشكل صحيح.",
    sentOk: "تم إرسال طلب التحويل بنجاح ✅",
    createFail: "تعذر إنشاء المعاملة.",
  },
};

export function initI18n(lang = "ar") {
  if (i18n.isInitialized) {
    changeLanguage("ar"); // Force ar
    return i18n;
  }
  i18nUse(initReactI18next)
    .init({
      lng: "ar", // Default to ar
      fallbackLng: "ar", // Fallback to ar
      compatibilityJSON: "v3",
      resources: { ar: { translation: ar } },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  return i18n;
}

// Export i18n instance for direct imports
export default i18n;
