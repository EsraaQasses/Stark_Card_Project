import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useStateContext } from '../../contexts/ContextProvider';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const Stacked = ({
  width = '100%',
  height = '320px',
  salesData = [],
  customersData = [],
}) => {
  const { currentColor, currentMode } = useStateContext();
  const { t } = useTranslation(['dashboard', 'common']);

  const accentColor = currentColor || '#06b6d4';
  const isDark = currentMode === 'Dark';

  const chart = useMemo(() => {
    const months = Array.from(
      new Set([
        ...salesData.map((item) => item.x),
        ...customersData.map((item) => item.x),
      ]),
    );

    const rows = months.map((month) => {
      const sales = Number(
        salesData.find((item) => item.x === month)?.y || 0,
      );
      const customers = Number(
        customersData.find((item) => item.x === month)?.y || 0,
      );

      return {
        month,
        sales,
        customers,
      };
    });

    const maxSales = Math.max(
      1,
      ...rows.map((item) => item.sales),
    );

    const maxCustomers = Math.max(
      1,
      ...rows.map((item) => item.customers),
    );

    return {
      rows,
      maxSales,
      maxCustomers,
    };
  }, [customersData, salesData]);

  if (!chart.rows.length) {
    return (
      <div
        className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-900/40"
        style={{ width, height }}
      >
        {t('chart.noData', 'No chart data available')}
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30"
      style={{ width }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          {t('chart.sales', 'Sales')}
        </span>

        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
          {t('chart.customers', 'Customers')}
        </span>
      </div>

      <div
        className="flex items-end gap-2 sm:gap-3"
        style={{
          height: typeof height === 'number'
            ? `${Math.max(220, height - 64)}px`
            : '260px',
        }}
      >
        {chart.rows.map((item) => {
          const salesHeight = clamp(
            (item.sales / chart.maxSales) * 100,
            item.sales > 0 ? 4 : 0,
            100,
          );

          const customersHeight = clamp(
            (item.customers / chart.maxCustomers) * 100,
            item.customers > 0 ? 4 : 0,
            100,
          );

          const monthKey = String(item.month || '')
            .toLowerCase();

          return (
            <div
              key={item.month}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              <div className="flex h-[210px] w-full items-end justify-center gap-1 sm:gap-2">
                <div
                  className="group relative w-[38%] max-w-8 rounded-t-lg transition-opacity hover:opacity-80"
                  style={{
                    height: `${salesHeight}%`,
                    backgroundColor: accentColor,
                  }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block">
                    {t('chart.sales', 'Sales')}: {item.sales.toLocaleString()}
                  </div>
                </div>

                <div
                  className={`group relative w-[38%] max-w-8 rounded-t-lg transition-opacity hover:opacity-80 ${
                    isDark
                      ? 'bg-slate-500'
                      : 'bg-slate-300'
                  }`}
                  style={{
                    height: `${customersHeight}%`,
                  }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block">
                    {t('chart.customers', 'Customers')}: {item.customers.toLocaleString()}
                  </div>
                </div>
              </div>

              <span className="mt-2 max-w-full truncate text-[10px] font-bold text-slate-400 sm:text-xs">
                {t(`months.${monthKey}`, item.month)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Stacked;