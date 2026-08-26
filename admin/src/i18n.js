import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// eslint-disable-next-line import/no-extraneous-dependencies -- pinned Syncfusion suite provides this package.

import translationEN from './locales/en/common.json';
import translationAR from './locales/ar/common.json';
import dashboardEN from './locales/en/dashboard.json';
import dashboardAR from './locales/ar/dashboard.json';
import productsEN from './locales/en/products.json';
import productsAR from './locales/ar/products.json';
import sectionsEN from './locales/en/sections.json';
import sectionsAR from './locales/ar/sections.json';
import customersEN from './locales/en/customers.json';
import customersAR from './locales/ar/customers.json';
import requestsEN from './locales/en/requests.json';
import requestsAR from './locales/ar/requests.json';
import paymentsEN from './locales/en/payments.json';
import paymentsAR from './locales/ar/payments.json';
import transactionsEN from './locales/en/transactions.json';
import transactionsAR from './locales/ar/transactions.json';
import agentsEN from './locales/en/agents.json';
import agentsAR from './locales/ar/agents.json';
import blacklistEN from './locales/en/blacklist.json';
import blacklistAR from './locales/ar/blacklist.json';
import adminsEN from './locales/en/admins.json';
import adminsAR from './locales/ar/admins.json';
import profileEN from './locales/en/profile.json';
import profileAR from './locales/ar/profile.json';
import currenciesEN from './locales/en/currencies.json';
import currenciesAR from './locales/ar/currencies.json';
import securityEN from './locales/en/security.json';
import securityAR from './locales/ar/security.json';
import apiEN from './locales/en/api.json';
import apiAR from './locales/ar/api.json';
import adsEN from './locales/en/ads.json';
import adsAR from './locales/ar/ads.json';
import notificationsEN from './locales/en/notifications.json';
import notificationsAR from './locales/ar/notifications.json';
import activityEN from './locales/en/activity.json';
import activityAR from './locales/ar/activity.json';
import settingsEN from './locales/en/settings.json';
import settingsAR from './locales/ar/settings.json';

const resources = {
  en: {
    common: translationEN,
    dashboard: dashboardEN,
    products: productsEN,
    sections: sectionsEN,
    customers: customersEN,
    requests: requestsEN,
    payments: paymentsEN,
    transactions: transactionsEN,
    agents: agentsEN,
    blacklist: blacklistEN,
    admins: adminsEN,
    profile: profileEN,
    currencies: currenciesEN,
    security: securityEN,
    api: apiEN,
    ads: adsEN,
    notifications: notificationsEN,
    activity: activityEN,
    settings: settingsEN,
  },
  ar: {
    common: translationAR,
    dashboard: dashboardAR,
    products: productsAR,
    sections: sectionsAR,
    customers: customersAR,
    requests: requestsAR,
    payments: paymentsAR,
    transactions: transactionsAR,
    agents: agentsAR,
    blacklist: blacklistAR,
    admins: adminsAR,
    profile: profileAR,
    currencies: currenciesAR,
    security: securityAR,
    api: apiAR,
    ads: adsAR,
    notifications: notificationsAR,
    activity: activityAR,
    settings: settingsAR,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ns: [
      'common', 'dashboard', 'products', 'sections', 'customers', 'requests',
      'payments', 'transactions', 'agents', 'blacklist', 'admins', 'profile',
      'currencies', 'security', 'api', 'ads', 'notifications', 'activity', 'settings'
    ],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

const handleLanguageChange = (language) => {
  const isRtl = (
    language?.startsWith('ar')
    || language === 'ar'
  );

  document.documentElement.dir = (
    isRtl ? 'rtl' : 'ltr'
  );

  document.documentElement.lang = (
    isRtl ? 'ar' : 'en'
  );
};

handleLanguageChange(
  i18n.resolvedLanguage
  || i18n.language
  || 'en',
);

i18n.on(
  'languageChanged',
  handleLanguageChange,
);

export default i18n;
