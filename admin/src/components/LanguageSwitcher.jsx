import React from 'react';

import { FiGlobe } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const {
    i18n,
  } = useTranslation();

  const currentLang = (
    i18n.resolvedLanguage
    || i18n.language
    || 'en'
  );

  const isArabic = (
    currentLang === 'ar'
  );

  const toggleLanguage = () => {
    i18n.changeLanguage(
      isArabic
        ? 'en'
        : 'ar',
    );
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={
        isArabic
          ? 'Switch to English'
          : 'التبديل إلى العربية'
      }
      title={
        isArabic
          ? 'Switch to English'
          : 'التبديل إلى العربية'
      }
      className="
        flex
        h-10
        items-center
        gap-2
        rounded-xl
        bg-slate-50
        px-3
        text-xs
        font-black
        text-slate-600
        transition
        hover:bg-slate-100
        hover:text-slate-900
        dark:bg-slate-800
        dark:text-slate-300
        dark:hover:bg-slate-700
        dark:hover:text-white
      "
    >
      <FiGlobe className="text-base" />

      <span>
        {isArabic
          ? 'EN'
          : 'AR'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;