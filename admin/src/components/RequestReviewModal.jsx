import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const RequestReviewModal = ({ request, onClose, onUpdateStatus, onAddComment }) => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestId = request.id || request.RequestID;
  const userName = request.user_name || request.UserName || t('catalog.table.unknownUser');
  const userEmail = request.user_email || request.UserEmail || t('catalog.table.noEmail');
  const userPhone = request.user_phone || request.UserPhone || '';
  const userImage = request.user_image || request.UserImage || 'https://via.placeholder.com/40x40/cccccc/666666?text=User';
  
  const rawType = request.request_type || request.RequestType;
  const requestType = t(`type.${rawType?.toLowerCase()}`, { defaultValue: rawType || '' });
  
  const rawStatus = request.status || request.Status;
  const status = t(`status.${rawStatus?.toLowerCase()}`, { defaultValue: rawStatus || '' });
  
  const rawPriority = request.priority || request.Priority;
  const priority = t(`priority.${rawPriority?.toLowerCase()}`, { defaultValue: rawPriority || '' });
  
  const amount = request.amount || request.Amount;
  const currency = request.currency || request.Currency || '';
  
  const details = request.details || request.Details;
  
  const rawDate = request.created_at || request.SubmittedDate;
  const submittedDate = rawDate ? new Date(rawDate).toLocaleDateString(i18n.resolvedLanguage) : '';

  const handleApprove = async () => {
    if (submitting) return;
    if (!decision && !notes) {
      if (!window.confirm(t('catalog.modal.alerts.approveConfirm'))) return;
    }

    const nextStatus = rawStatus === 'pending' ? 'in_progress' : 'completed';
    setSubmitting(true);
    try {
      const updated = await onUpdateStatus?.(requestId, nextStatus, notes || decision);
      if (!updated) return;
      if (notes && decision && onAddComment) await onAddComment(requestId, decision, true);
      alert(t('catalog.modal.alerts.approveSuccess', { id: requestId, decision: decision || t('catalog.modal.alerts.noNotesAdded', 'No notes added') }));
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting) return;
    if (!decision) {
      alert(t('catalog.modal.alerts.rejectReasonRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const updated = await onUpdateStatus?.(requestId, 'rejected', notes, decision);
      if (!updated) return;
      alert(t('catalog.modal.alerts.rejectSuccess', { id: requestId, reason: decision }));
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestInfo = () => {
    alert(`${t('catalog.modal.alerts.fullDetailsTitle')}\n\n${JSON.stringify(request, null, 2)}`);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
      <div className="bg-white dark:bg-secondary-dark-bg p-6 rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('catalog.modal.title', { id: requestId })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-start">
          <div className="space-y-3">
            <div>
              <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.userInfo')}</strong>
              <div className="flex items-center gap-3 mt-1">
                <img
                  className="rounded-full w-10 h-10 object-cover border dark:border-gray-700"
                  src={userImage}
                  alt={userName}
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/40x40/cccccc/666666?text=User';
                  }}
                />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{userEmail}</p>
                  {userPhone && <p className="text-sm text-gray-400 dark:text-gray-500">{userPhone}</p>}
                </div>
              </div>
            </div>
            <div>
              <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.requestType')}</strong>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{requestType}</p>
            </div>
            <div>
              <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.status')}</strong>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{status}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.submittedDate')}</strong>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{submittedDate}</p>
            </div>
            <div>
              <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.priority')}</strong>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{priority}</p>
            </div>
            {amount && (
              <div>
                <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.amount')}</strong>
                <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                  {parseFloat(amount).toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t(`currency.${currency.toLowerCase()}`, { defaultValue: currency.toUpperCase() })}
                </p>
              </div>
            )}
            {details && (
              <div>
                <strong className="text-gray-700 dark:text-gray-300">{t('catalog.modal.labels.details')}</strong>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{details}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 text-start">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            {t('catalog.modal.fields.decisionLabel')}
          </label>
          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder={t('catalog.modal.fields.decisionPlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm h-20 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6 text-start">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            {t('catalog.modal.fields.notesLabel')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('catalog.modal.fields.notesPlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm h-16 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={handleRequestInfo}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm transition"
          >
            {t('catalog.modal.buttons.viewDetails')}
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50"
            >
              {t('catalog.modal.buttons.reject')}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50"
            >
              {t('catalog.modal.buttons.approve')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestReviewModal;
