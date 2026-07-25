import React from 'react';
import { ChartComponent, SeriesCollectionDirective, SeriesDirective, Inject, Legend, Category, StackingColumnSeries, Tooltip } from '@syncfusion/ej2-react-charts';
import { useTranslation } from 'react-i18next';

import { stackedPrimaryXAxis, stackedPrimaryYAxis } from '../../data/homeChart';
import { useStateContext } from '../../contexts/ContextProvider';

const Stacked = ({ width, height, salesData = [], customersData = [] }) => {
  const { currentMode } = useStateContext();
  const { t } = useTranslation(["dashboard", "common"]);

  // Build the series using the dynamic data
  const customSeries = [
    {
      dataSource: salesData,
      xName: 'x',
      yName: 'y',
      name: 'Sales',
      type: 'StackingColumn',
      background: '#3B82F6',
    },
    {
      dataSource: customersData,
      xName: 'x',
      yName: 'y',
      name: 'Customers',
      type: 'StackingColumn',
      background: '#10B981',
    },
  ];

  // Dynamically translate the category labels (months) and series names (Sales/Customers)
  const translatedCustomSeries = customSeries.map((series) => {
    const translatedData = series.dataSource.map((dataPoint) => ({
      ...dataPoint,
      x: t(`months.${dataPoint.x.toLowerCase()}`, dataPoint.x),
    }));

    return {
      ...series,
      name: t(`chart.${series.name.toLowerCase()}`, series.name),
      dataSource: translatedData,
    };
  });

  return (
    <ChartComponent
      id="charts"
      primaryXAxis={stackedPrimaryXAxis}
      primaryYAxis={stackedPrimaryYAxis}
      width={width}
      height={height}
      chartArea={{ border: { width: 0 } }}
      tooltip={{ enable: true }}
      background={currentMode === 'Dark' ? '#33373E' : '#fff'}
      legendSettings={{ background: 'white' }}
    >
      <Inject services={[StackingColumnSeries, Category, Legend, Tooltip]} />
      <SeriesCollectionDirective>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        {translatedCustomSeries.map((item, index) => <SeriesDirective key={index} {...item} />)}
      </SeriesCollectionDirective>
    </ChartComponent>
  );
};

export default Stacked;
