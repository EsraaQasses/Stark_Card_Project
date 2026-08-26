import React, { useMemo } from 'react';

import { useStateContext } from '../contexts/ContextProvider';

const ProviderDistribution = ({
  data = [],
  emptyText = 'No data',
}) => {
  const { currentColor } = useStateContext();
  const accentColor = currentColor || '#06b6d4';

  const total = useMemo(() => (
    data.reduce(
      (sum, item) => sum + Number(item?.y || 0),
      0,
    )
  ), [data]);

  if (!data.length || total <= 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm font-semibold text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const value = Number(item?.y || 0);
        const percentage = total > 0
          ? (value / total) * 100
          : 0;

        return (
          <div
            key={`${item?.x || 'provider'}-${index}`}
            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                {item?.x || '—'}
              </span>

              <span className="shrink-0 text-xs font-black text-slate-500 dark:text-slate-400">
                {value}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max(
                    value > 0 ? 4 : 0,
                    percentage,
                  )}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>

            <p className="mt-2 text-end text-[11px] font-bold text-slate-400">
              {percentage.toFixed(1)}%
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ProviderDistribution;