import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineCancel } from 'react-icons/md';
import { BsCheck } from 'react-icons/bs';
import { TooltipComponent } from '@syncfusion/ej2-react-popups';

import { themeColors } from '../data/themeColors';
import { useStateContext } from '../contexts/ContextProvider';

const ThemeSettings = ({ onClose }) => {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const { setColor, setMode, currentMode, currentColor, setThemeSettings } = useStateContext();
  const handleClose = onClose || (() => setThemeSettings(false));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className={`bg-half-transparent w-screen fixed nav-item top-0 ${isArabic ? 'left-0' : 'right-0'} z-50`}
    >
      <div className={`${isArabic ? 'float-left text-right' : 'float-right text-left'} h-screen dark:text-gray-200 bg-white dark:bg-[#484B52] w-full sm:w-[400px] shadow-2xl`}>
        <div className={`flex justify-between items-center p-4 ${isArabic ? 'mr-4' : 'ml-4'}`}>
          <p className="font-semibold text-lg">{t('title')}</p>
          <button
            type="button"
            onClick={handleClose}
            style={{ color: 'rgb(153, 171, 180)', borderRadius: '50%' }}
            className="text-2xl p-3 hover:drop-shadow-xl hover:bg-light-gray transition-colors"
          >
            <MdOutlineCancel />
          </button>
        </div>

        <div className={`flex-col border-t-1 border-color p-4 ${isArabic ? 'mr-4' : 'ml-4'}`}>
          <p className="font-semibold text-xl">{t('themeOption')}</p>

          <div className="mt-4">
            <input
              type="radio"
              id="light"
              name="theme"
              value="Light"
              className="cursor-pointer"
              onChange={setMode}
              checked={currentMode === 'Light'}
            />
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label htmlFor="light" className={`${isArabic ? 'mr-2' : 'ml-2'} text-md cursor-pointer`}>
              {t('modes.light')}
            </label>
          </div>
          <div className="mt-2">
            <input
              type="radio"
              id="dark"
              name="theme"
              value="Dark"
              onChange={setMode}
              className="cursor-pointer"
              checked={currentMode === 'Dark'}
            />
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label htmlFor="dark" className={`${isArabic ? 'mr-2' : 'ml-2'} text-md cursor-pointer`}>
              {t('modes.dark')}
            </label>
          </div>
        </div>

        <div className={`p-4 border-t-1 border-color ${isArabic ? 'mr-4' : 'ml-4'}`}>
          <p className="font-semibold text-xl">{t('themeColors')}</p>
          <div className="flex gap-3">
            {themeColors.map((item, index) => {
              const colorKey = item.name.toLowerCase();
              const translatedColorName = t(`common:colors.${colorKey}`, item.name);

              return (
                <TooltipComponent key={index} content={translatedColorName} position="TopCenter">
                  <div
                    className="relative mt-2 cursor-pointer flex gap-5 items-center"
                    key={item.name}
                  >
                    <button
                      type="button"
                      className="h-10 w-10 rounded-full cursor-pointer"
                      style={{ backgroundColor: item.color }}
                      onClick={() => setColor(item.color)}
                    >
                      <BsCheck className={`${isArabic ? 'mr-2' : 'ml-2'} text-2xl text-white ${item.color === currentColor ? 'block' : 'hidden'}`} />
                    </button>
                  </div>
                </TooltipComponent>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
