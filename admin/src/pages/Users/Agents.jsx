import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Inject,
  Toolbar,
  Sort,
  Filter,
  Selection,
} from '@syncfusion/ej2-react-grids';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const Agents = () => {
  const { t, i18n } = useTranslation(['agents', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [agentsData, setAgentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [updatingCommission, setUpdatingCommission] = useState(false);

  const toolbarOptions = useMemo(() => [
    'Search',
    { text: t('common:common.buttons.refresh', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/agents/agents/');
      setAgentsData(response.data);
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const formattedAgentsData = agentsData.map((agent) => ({
    id: agent.id,
    username: agent.username,
    full_name: agent.full_name,
    clients_count: agent.clients_count,
    balance: agent.balance,
    commission_rate: agent.commission_rate,
    products_count: agent.products_count,
    balance_formatted: `$${agent.balance?.toLocaleString(i18n.resolvedLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0.00'}`,
    commission_rate_formatted: `${agent.commission_rate}%`,
    status: t('status.active'),
  }));

  const handleRowSelected = (args) => {
    setSelectedAgent(args.data);
  };

  const handleViewUsers = () => {
    if (selectedAgent) {
      window.location.href = `/agents-users/${selectedAgent.id}`;
    }
  };

  const handleUpdateCommission = () => {
    if (selectedAgent) {
      setCommissionRate(selectedAgent.commission_rate.toString());
      setShowCommissionModal(true);
    }
  };

  const handleSaveCommission = async () => {
    if (!selectedAgent || !commissionRate) return;

    try {
      setUpdatingCommission(true);
      await axiosInstance.post(`/agents/agent/${selectedAgent.id}/commission/`, {
        commission_rate: parseFloat(commissionRate),
      });

      await fetchAgents();
      setShowCommissionModal(false);
      setCommissionRate('');
      alert(t('alerts.updateSuccess'));
    } catch (err) {
      console.error('Error updating commission:', err);
      alert(t('alerts.updateFailed'));
    } finally {
      setUpdatingCommission(false);
    }
  };

  const handleToolbarClick = (args) => {
    if (args.item.id.includes('Refresh')) {
      fetchAgents();
    }
  };

  const handleDemoteAgent = async () => {
    if (!selectedAgent) return;

    if (window.confirm(t('alerts.demoteConfirm', { name: selectedAgent.full_name }))) {
      try {
        await axiosInstance.post(`/agents/demote-to-user/${selectedAgent.id}/`);
        await fetchAgents();
        setSelectedAgent(null);
        alert(t('alerts.demoteSuccess'));
      } catch (err) {
        console.error('Error demoting agent:', err);
        alert(t('alerts.demoteFailed'));
      }
    }
  };

  const handleModalClose = () => {
    setShowCommissionModal(false);
  };

  const calculateTotalBalance = () => { return agentsData.reduce((sum, agent) => sum + agent.balance, 0); };

  const calculateAverageCommission = () => {
    if (agentsData.length === 0) return 0;
    return agentsData.reduce((sum, agent) => sum + agent.commission_rate, 0) / agentsData.length;
  };

  const calculateTotalClients = () => {
    return agentsData.reduce((sum, agent) => sum + agent.clients_count, 0);
  };

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500">{error}</div>
          <button
            type="button"
            onClick={fetchAgents}
            className="ms-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start">
      <Header category={t('category')} title={t('title')} />

      {selectedAgent && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {t('selectedAgent.title', { name: selectedAgent.full_name })}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleViewUsers}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
              >
                {t('selectedAgent.buttons.viewUsers')}
              </button>
              <button
                type="button"
                onClick={handleUpdateCommission}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
              >
                {t('selectedAgent.buttons.updateCommission')}
              </button>
              <button
                type="button"
                onClick={handleDemoteAgent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
              >
                {t('selectedAgent.buttons.demote')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-900 dark:text-gray-100">
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('selectedAgent.labels.currentCommission')}</p>
              <p className="font-semibold">{selectedAgent.commission_rate_formatted}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('selectedAgent.labels.totalClients')}</p>
              <p className="font-semibold">{selectedAgent.clients_count}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('selectedAgent.labels.assignedProducts')}</p>
              <p className="font-semibold">{selectedAgent.products_count}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('selectedAgent.labels.totalBalance')}</p>
              <p className="font-semibold">{selectedAgent.balance_formatted}</p>
            </div>
          </div>
        </div>
      )}

      <GridComponent
        dataSource={formattedAgentsData}
        allowPaging
        pageSettings={{ pageSize: 10 }}
        allowSorting
        allowFiltering
        toolbar={toolbarOptions}
        height={400}
        rowSelected={handleRowSelected}
        selectionSettings={{ type: 'Single' }}
        toolbarClick={handleToolbarClick}
        enableRtl={isArabic}
        locale={isArabic ? 'ar' : 'en-US'}
      >
        <ColumnsDirective>
          <ColumnDirective
            field="id"
            headerText={t('table.headers.id')}
            width="80"
            textAlign="Center"
          />
          <ColumnDirective
            field="username"
            headerText={t('table.headers.username')}
            width="120"
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            field="full_name"
            headerText={t('table.headers.fullName')}
            width="150"
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            field="clients_count"
            headerText={t('table.headers.clients')}
            width="80"
            textAlign="Center"
          />
          <ColumnDirective
            field="balance_formatted"
            headerText={t('table.headers.balance')}
            width="120"
            textAlign="Center"
          />
          <ColumnDirective
            field="commission_rate_formatted"
            headerText={t('table.headers.commission')}
            width="100"
            textAlign="Center"
          />
          <ColumnDirective
            field="products_count"
            headerText={t('table.headers.products')}
            width="80"
            textAlign="Center"
          />
          <ColumnDirective
            field="status"
            headerText={t('table.headers.status')}
            width="100"
            textAlign="Center"
          />
        </ColumnsDirective>
        <Inject services={[Page, Toolbar, Sort, Filter, Selection]} />
      </GridComponent>

      {showCommissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#42464D] rounded-lg p-6 w-full max-w-md border dark:border-gray-700 text-start">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {t('modal.title', { name: selectedAgent?.full_name })}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('modal.label')}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-secondary-dark-bg dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('modal.placeholder')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition"
                disabled={updatingCommission}
              >
                {t('modal.buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveCommission}
                disabled={updatingCommission || !commissionRate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:bg-gray-400"
              >
                {updatingCommission ? t('modal.buttons.updating') : t('modal.buttons.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-semibold">{t('stats.totalAgents')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{agentsData.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 font-semibold">{t('stats.totalClients')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {calculateTotalClients()}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-purple-800 dark:text-purple-200 font-semibold">{t('stats.totalBalance')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            ${calculateTotalBalance().toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-orange-800 dark:text-orange-200 font-semibold">{t('stats.avgCommission')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {`${calculateAverageCommission().toFixed(1)}%`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Agents;
