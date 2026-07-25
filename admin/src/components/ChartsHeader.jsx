import React from 'react';
import { useTranslation } from 'react-i18next';

const ChartsHeader = ({ category, title }) => {
  const { t } = useTranslation('common');

  return (
    <div className=" mb-10">
      <div>
        <p className="text-lg text-gray-400">{t('common.chart')}</p>
        <p className="text-3xl font-extrabold tracking-tight dark:text-gray-200 text-slate-900">{category}</p>
      </div>
      <p className="text-center dark:text-gray-200 text-xl mb-2 mt-3">{title}</p>
    </div>
  );
};

export default ChartsHeader;
