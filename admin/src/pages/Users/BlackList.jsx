import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Selection,
  Inject,
  Edit,
  Toolbar,
  Sort,
  Filter,
} from '@syncfusion/ej2-react-grids';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';
import useSyncfusionGridLocale
  from '../../hooks/useSyncfusionGridLocale';

const Blacklist = () => {
  const { t, i18n } = useTranslation(['blacklist', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  useSyncfusionGridLocale(
    i18n.resolvedLanguage
    || i18n.language,
  );
  const [blacklistData, setBlacklistData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gridInstance, setGridInstance] = useState(null);

  const selectionsettings = { persistSelection: true };
  const editing = { allowDeleting: true, allowEditing: false, allowAdding: false };

  const toolbarOptions = useMemo(() => [
    { text: t('table.buttons.unblock', 'Unblock'), id: 'Unblock', prefixIcon: 'e-play' },
    { text: t('table.buttons.delete', 'Delete'), id: 'deletegrid', prefixIcon: 'e-delete' },
    { text: t('stats.refresh', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const fetchBannedUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/users/banned-users/');
      setBlacklistData(response.data);
    } catch (err) {
      console.error('Error fetching banned users:', err);
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  const getRoleClass = (role) => {
    if (role === 'admin') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (role === 'agent') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  };

  const handleDeleteUsers = async (selected) => {
    if (window.confirm(t('alerts.deleteConfirm', { count: selected.length }))) {
      try {
        alert(t('alerts.deleteMarked', { count: selected.length }));
      } catch (err) {
        console.error('Error deleting users:', err);
        alert(t('alerts.deleteFailed'));
      }
    }
  };

  const handleUnblockUsers = async (selected) => {
    try {
      const unbanPromises = selected.map((user) => axiosInstance.post(`/users/unban/${user.id}/`));
      await Promise.all(unbanPromises);
      await fetchBannedUsers();
      alert(t('alerts.unblockSuccess', { count: selected.length }));
    } catch (err) {
      console.error('Error unblocking users:', err);
      alert(t('alerts.unblockFailed'));
    }
  };

  const toolbarClick = async (args) => {
    if (!gridInstance) return;

    const selected = gridInstance.getSelectedRecords();

    if (args.item.id.includes('deletegrid')) {
      if (selected.length > 0) {
        await handleDeleteUsers(selected);
      } else {
        alert(t('alerts.selectToDelete'));
      }
    }

    if (args.item.id.includes('Unblock')) {
      if (selected.length > 0) {
        await handleUnblockUsers(selected);
      } else {
        alert(t('alerts.selectToUnblock'));
      }
    }

    if (args.item.id.includes('Refresh')) {
      fetchBannedUsers();
    }
  };

  const blacklistGrid = useMemo(() => [
    {
      type: 'checkbox',
      width: '50',
    },
    {
      field: 'id',
      headerText: t('table.headers.id'),
      width: '80',
      textAlign: 'Center',
      isPrimaryKey: true,
    },
    {
      field: 'name',
      headerText: t('table.headers.username'),
      width: '120',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'full_name',
      headerText: t('table.headers.fullName'),
      width: '150',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'email',
      headerText: t('table.headers.email'),
      width: '180',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'phone',
      headerText: t('table.headers.phone'),
      width: '130',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'country',
      headerText: t('table.headers.country'),
      width: '100',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'role',
      headerText: t('table.headers.role'),
      width: '100',
      textAlign: isArabic ? 'Right' : 'Left',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleClass(props.role)}`}>
          {t(`roles.${props.role?.toLowerCase()}`, { defaultValue: props.role })}
        </span>
      ),
    },
    {
      field: 'is_banned',
      headerText: t('table.headers.status'),
      width: '100',
      textAlign: 'Center',
      template: () => (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {t('status.banned')}
        </span>
      ),
    },
    {
      field: 'date_joined',
      headerText: t('table.headers.joinedDate'),
      width: '120',
      format: 'yMd',
      textAlign: 'Center',
    },
    {
      field: 'last_login',
      headerText: t('table.headers.lastLogin'),
      width: '120',
      format: 'yMd',
      textAlign: 'Center',
      template: (props) => (
        <span className="text-gray-900 dark:text-gray-100">
          {props.last_login ? new Date(props.last_login).toLocaleDateString(i18n.resolvedLanguage) : t('table.never')}
        </span>
      ),
    },
  ], [t, isArabic, i18n.resolvedLanguage]);

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
            onClick={fetchBannedUsers}
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

      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 font-semibold">{t('stats.totalBanned')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{blacklistData.length}</p>
        </div>

        <button
          type="button"
          onClick={fetchBannedUsers}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition text-sm flex items-center gap-2"
        >
          {t('stats.refresh')}
        </button>
      </div>

      {blacklistData.length > 0 ? (
        <GridComponent
          dataSource={blacklistData}
          enableHover={false}
          allowPaging
          pageSettings={{ pageCount: 5, pageSize: 10 }}
          selectionSettings={selectionsettings}
          toolbar={toolbarOptions}
          editSettings={editing}
          allowSorting
          allowFiltering
          toolbarClick={toolbarClick}
          width="auto"
          ref={(g) => setGridInstance(g)}
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
        >
          <ColumnsDirective>
            {blacklistGrid.map((item, index) => (
              <ColumnDirective key={index} {...item} />
            ))}
          </ColumnsDirective>
          <Inject services={[Page, Selection, Toolbar, Edit, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">{t('emptyState.desc')}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900 rounded-lg">
        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">{t('about.title')}</h4>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
          <li>{t('about.rule1')}</li>
          <li>{t('about.rule2')}</li>
          <li>{t('about.rule3')}</li>
          <li>{t('about.rule4')}</li>
        </ul>
      </div>
    </div>
  );
};

export default Blacklist;
