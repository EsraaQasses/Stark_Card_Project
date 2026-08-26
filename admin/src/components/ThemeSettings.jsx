import React, {
  useCallback,
  useEffect,
} from 'react';

import { BsCheck } from 'react-icons/bs';
import { MdOutlineCancel } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { useStateContext } from '../contexts/ContextProvider';
import { themeColors } from '../data/themeColors';

const ThemeSettings = ({ onClose }) => {
  const {
    t,
    i18n,
  } = useTranslation([
    'settings',
    'common',
  ]);

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const {
    setColor,
    setMode,
    currentMode,
    currentColor,
    setThemeSettings,
  } = useStateContext();

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    setThemeSettings(false);
  }, [
    onClose,
    setThemeSettings,
  ]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [handleClose]);

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      onClick={(event) => {
        if (
          event.target
          === event.currentTarget
        ) {
          handleClose();
        }
      }}
      className="
        fixed
        inset-0
        z-[1400]
        bg-slate-950/45
        backdrop-blur-[2px]
      "
    >
      <aside
        className={`
          absolute
          bottom-0
          top-0
          w-full
          max-w-[400px]
          overflow-y-auto
          border-slate-200
          bg-white
          shadow-2xl
          dark:border-slate-800
          dark:bg-secondary-dark-bg
          ${
            isArabic
              ? 'left-0 border-r'
              : 'right-0 border-l'
          }
        `}
      >
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-slate-100
            p-5
            dark:border-slate-800
          "
        >
          <div className="text-start">
            <p
              className="
                text-lg
                font-black
                text-slate-950
                dark:text-white
              "
            >
              {t('title')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            title={t(
              'common:close',
              'Close',
            )}
            aria-label={t(
              'common:close',
              'Close',
            )}
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              text-xl
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
          >
            <MdOutlineCancel />
          </button>
        </div>

        <section
          className="
            border-b
            border-slate-100
            p-5
            dark:border-slate-800
          "
        >
          <p
            className="
              text-base
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {t('themeOption')}
          </p>

          <div className="mt-4 grid gap-2">
            <label
              className="
                flex
                cursor-pointer
                items-center
                gap-3
                rounded-2xl
                border
                border-slate-100
                bg-slate-50/70
                p-4
                text-sm
                font-black
                text-slate-700
                transition
                hover:bg-slate-100
                dark:border-slate-800
                dark:bg-slate-900/40
                dark:text-slate-200
                dark:hover:bg-slate-800
              "
            >
              <input
                type="radio"
                name="theme"
                value="Light"
                onChange={setMode}
                checked={
                  currentMode === 'Light'
                }
              />

              {t('modes.light')}
            </label>

            <label
              className="
                flex
                cursor-pointer
                items-center
                gap-3
                rounded-2xl
                border
                border-slate-100
                bg-slate-50/70
                p-4
                text-sm
                font-black
                text-slate-700
                transition
                hover:bg-slate-100
                dark:border-slate-800
                dark:bg-slate-900/40
                dark:text-slate-200
                dark:hover:bg-slate-800
              "
            >
              <input
                type="radio"
                name="theme"
                value="Dark"
                onChange={setMode}
                checked={
                  currentMode === 'Dark'
                }
              />

              {t('modes.dark')}
            </label>
          </div>
        </section>

        <section className="p-5">
          <p
            className="
              text-base
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {t('themeColors')}
          </p>

          <div
            className="
              mt-4
              flex
              flex-wrap
              gap-3
            "
          >
            {themeColors.map((item) => {
              const colorKey = (
                item.name.toLowerCase()
              );

              const translatedColorName = t(
                `common:colors.${colorKey}`,
                item.name,
              );

              return (
                <button
                  key={item.name}
                  type="button"
                  title={translatedColorName}
                  aria-label={
                    translatedColorName
                  }
                  onClick={() => (
                    setColor(item.color)
                  )}
                  className="
                    relative
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-full
                    shadow-sm
                    ring-offset-2
                    transition
                    hover:scale-105
                    focus:outline-none
                    focus-visible:ring-2
                    dark:ring-offset-slate-900
                  "
                  style={{
                    backgroundColor:
                      item.color,
                  }}
                >
                  {item.color
                    === currentColor && (
                    <BsCheck
                      className="
                        text-2xl
                        text-white
                      "
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default ThemeSettings;