import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdOutlineCancel } from 'react-icons/md';

import { useStateContext } from '../contexts/ContextProvider';
import axiosInstance from '../utils/axiosConfig';

const Payments = ({ onClose }) => {
  const navigate = useNavigate();

  const {
    currentColor,
    setIsClicked,
    initialState,
  } = useStateContext();

  const {
    t,
    i18n,
  } = useTranslation([
    'payments',
    'common',
  ]);

  const isRtl = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const panelRef = useRef(null);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    setIsClicked(initialState);
  }, [
    initialState,
    onClose,
    setIsClicked,
  ]);

  const fetchRecentPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get(
        'payment/payment/recent/',
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];

      setPayments(
        rows.slice(0, 5),
      );
    } catch (err) {
      const message = (
        err.response?.data?.detail
        || err.response?.data?.error
        || t(
          'history.error',
          {
            defaultValue:
              'Failed to fetch payments',
          },
        )
      );

      setError(message);

      console.error(
        'Error fetching payments:',
        err,
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRecentPayments();
  }, [fetchRecentPayments]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        panelRef.current
        && !panelRef.current.contains(
          event.target,
        )
        && !event.target.closest(
          '[data-prevent-outside-close="true"]',
        )
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [handleClose]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: {
        color: '#10B981',
        text: t(
          'status.success',
          'Success',
        ),
      },

      pending: {
        color: '#F59E0B',
        text: t(
          'status.pending',
          'Pending',
        ),
      },

      processing: {
        color: '#3B82F6',
        text: t(
          'status.processing',
          'Processing',
        ),
      },

      failed: {
        color: '#EF4444',
        text: t(
          'status.failed',
          'Failed',
        ),
      },

      cancelled: {
        color: '#6B7280',
        text: t(
          'status.cancelled',
          'Cancelled',
        ),
      },
    };

    const config = (
      statusConfig[status]
      || statusConfig.pending
    );

    return (
      <span
        style={{
          background: config.color,
          color: 'white',
        }}
        className="
          rounded-full
          px-2
          py-0.5
          text-[10px]
          font-medium
        "
      >
        {config.text}
      </span>
    );
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$',
      SYP: t(
        'currency.syp_symbol',
        'ل.س',
      ),
      EUR: '€',
    };

    return (
      symbols[currency?.toUpperCase()]
      || currency
    );
  };

  const getCurrencyColor = (currency) => {
    const colors = {
      USD: {
        bg:
          'bg-blue-105 dark:bg-blue-900/30',
        text:
          'text-blue-600 dark:text-blue-400',
      },

      SYP: {
        bg:
          'bg-green-105 dark:bg-green-900/30',
        text:
          'text-green-600 dark:text-green-400',
      },

      EUR: {
        bg:
          'bg-purple-105 dark:bg-purple-900/30',
        text:
          'text-purple-600 dark:text-purple-400',
      },
    };

    return (
      colors[currency?.toUpperCase()]
      || {
        bg:
          'bg-gray-105 dark:bg-gray-800/40',
        text:
          'text-gray-500 dark:text-gray-400',
      }
    );
  };

  const formatAmount = (
    amount,
    currency,
  ) => {
    const numericAmount = Number(
      amount,
    );

    const safeAmount = Number.isFinite(
      numericAmount,
    )
      ? numericAmount
      : 0;

    const normalizedCurrency = (
      currency?.toUpperCase()
    );

    const formattedValue =
      safeAmount.toLocaleString(
        i18n.resolvedLanguage
        || i18n.language,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      );

    if (
      normalizedCurrency === 'USD'
    ) {
      return `$${formattedValue}`;
    }

    if (
      normalizedCurrency === 'SYP'
    ) {
      return `${formattedValue} ${t(
        'currency.syp',
        'SYP',
      )}`;
    }

    return `${formattedValue} ${t(
      `currency.${currency?.toLowerCase()}`,
      {
        defaultValue: currency,
      },
    )}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return '—';
    }

    const date = new Date(
      dateString,
    );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return String(dateString);
    }

    const now = new Date();

    const diffTime = Math.abs(
      now - date,
    );

    const diffDays = Math.floor(
      diffTime
      / (1000 * 60 * 60 * 24),
    );

    const locale = (
      i18n.resolvedLanguage
      || i18n.language
    );

    if (diffDays === 0) {
      return `${t(
        'common:today',
        'Today',
      )}, ${date.toLocaleTimeString(
        locale,
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      )}`;
    }

    if (diffDays === 1) {
      return `${t(
        'common:yesterday',
        'Yesterday',
      )}, ${date.toLocaleTimeString(
        locale,
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      )}`;
    }

    if (diffDays < 7) {
      return t(
        'recent.daysAgo',
        {
          count: diffDays,
          defaultValue:
            `${diffDays} days ago`,
        },
      );
    }

    return date.toLocaleDateString(
      locale,
    );
  };

  const handleViewAllPayments = () => {
    handleClose();

    navigate(
      '/all-payments',
    );
  };

  const handleRefresh = () => {
    fetchRecentPayments();
  };

  const layoutClasses = `
    nav-item
    fixed
    bottom-4
    left-2
    right-2
    z-[9999]
    mx-auto
    flex
    max-h-[80vh]
    w-[calc(100vw-16px)]
    flex-col
    rounded-xl
    border
    border-gray-200
    bg-white
    p-4
    shadow-2xl
    dark:border-gray-800
    dark:bg-[#42464D]

    md:absolute
    md:bottom-auto
    md:top-full
    md:left-1/2
    md:right-auto
    md:mt-2
    md:max-h-[70vh]
    md:w-[400px]
    md:-translate-x-1/2

    ${
      isRtl
        ? 'text-right'
        : 'text-left'
    }
  `;

  if (loading) {
    return (
      <div
        ref={panelRef}
        className={layoutClasses}
      >
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-gray-100
            pb-3
            dark:border-gray-700
          "
        >
          <p
            className="
              text-base
              font-bold
              dark:text-gray-200
            "
          >
            {t(
              'recent.title',
              'Recent Payments',
            )}
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="
              rounded-full
              p-2
              text-2xl
              text-gray-400
              transition-colors
              hover:bg-gray-100
              hover:text-gray-700
              focus:outline-none
              dark:text-gray-400
              dark:hover:bg-gray-700
              dark:hover:text-gray-200
            "
          >
            <MdOutlineCancel />
          </button>
        </div>

        <div
          className="
            flex
            h-40
            items-center
            justify-center
          "
        >
          <div
            className="
              h-8
              w-8
              animate-spin
              rounded-full
              border-b-2
              border-blue-500
            "
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={panelRef}
        className={layoutClasses}
      >
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-gray-100
            pb-3
            dark:border-gray-700
          "
        >
          <p
            className="
              text-base
              font-bold
              dark:text-gray-200
            "
          >
            {t(
              'recent.title',
              'Recent Payments',
            )}
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="
              rounded-full
              p-2
              text-2xl
              text-gray-400
              transition-colors
              hover:bg-gray-100
              hover:text-gray-700
              focus:outline-none
              dark:text-gray-400
              dark:hover:bg-gray-700
              dark:hover:text-gray-200
            "
          >
            <MdOutlineCancel />
          </button>
        </div>

        <div
          className="
            flex
            h-40
            flex-col
            items-center
            justify-center
            gap-3
          "
        >
          <div
            className="
              px-4
              text-center
              text-sm
              text-red-500
            "
          >
            {error}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="
              rounded-lg
              bg-blue-500
              px-4
              py-2
              text-xs
              font-semibold
              text-white
              transition
              hover:bg-blue-600
            "
          >
            {t(
              'recent.buttons.retry',
              'Retry',
            )}
          </button>
        </div>
      </div>
    );
  }

  const activePaymentsCount =
    payments.filter(
      (payment) => (
        payment.status === 'pending'
        || payment.status
          === 'processing'
      ),
    ).length;

  return (
    <div
      ref={panelRef}
      className={layoutClasses}
    >
      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-gray-100
          pb-3
          dark:border-gray-700
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <p
            className="
              text-base
              font-bold
              dark:text-gray-200
            "
          >
            {t(
              'recent.title',
              'Recent Payments',
            )}
          </p>

          {payments.length > 0 && (
            <span
              className="
                rounded
                bg-orange-500
                px-1.5
                py-0.5
                text-[10px]
                font-bold
                text-white
              "
            >
              {activePaymentsCount}{' '}

              {t(
                'recent.activeBadge',
                {
                  count:
                    activePaymentsCount,
                  defaultValue:
                    'Active',
                },
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="
            rounded-full
            p-2
            text-2xl
            text-gray-400
            transition-colors
            hover:bg-gray-100
            hover:text-gray-700
            focus:outline-none
            dark:text-gray-400
            dark:hover:bg-gray-700
            dark:hover:text-gray-200
          "
          aria-label={t(
            'common.close',
            'Close',
          )}
        >
          <MdOutlineCancel />
        </button>
      </div>

      <div
        className="
          -ml-1
          -mr-1
          mt-3
          flex-1
          overflow-y-auto
          pl-1
          pr-1
        "
      >
        {payments.length === 0 ? (
          <div
            className="
              flex
              flex-col
              items-center
              justify-center
              py-8
              text-gray-500
            "
          >
            <div
              className="
                mb-1
                text-sm
                font-semibold
              "
            >
              {t(
                'recent.emptyTitle',
                'No payments found',
              )}
            </div>

            <div
              className="
                text-center
                text-xs
              "
            >
              {t(
                'recent.emptyDesc',
                'Payments will appear here once they are processed',
              )}
            </div>
          </div>
        ) : (
          payments.map((payment) => {
            const currencyColor =
              getCurrencyColor(
                payment.currency,
              );

            return (
              <div
                key={payment.id}
                className={`
                  flex
                  items-start
                  gap-3
                  rounded-xl
                  border-b
                  border-gray-100
                  p-2.5
                  transition-all
                  hover:bg-gray-50
                  dark:border-gray-750/50
                  dark:hover:bg-[#4A4E55]

                  ${
                    isRtl
                      ? 'text-right'
                      : 'text-left'
                  }
                `}
              >
                <div
                  className="
                    mt-0.5
                    flex-shrink-0
                  "
                >
                  <div
                    className={`
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      ${currencyColor.bg}
                    `}
                  >
                    <span
                      className={`
                        text-sm
                        font-bold
                        ${currencyColor.text}
                      `}
                    >
                      {getCurrencySymbol(
                        payment.currency,
                      )}
                    </span>
                  </div>
                </div>

                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-1
                    "
                  >
                    <p
                      className="
                        truncate
                        text-sm
                        font-semibold
                        dark:text-gray-200
                      "
                    >
                      {payment.user_name
                        || `${t(
                          'common:user',
                          'User',
                        )} #${payment.user}`}
                    </p>

                    <p
                      className="
                        flex-shrink-0
                        text-sm
                        font-bold
                        dark:text-white
                      "
                    >
                      {formatAmount(
                        payment.final_price,
                        payment.currency,
                      )}
                    </p>
                  </div>

                  <p
                    className="
                      mt-0.5
                      truncate
                      text-[11px]
                      text-gray-400
                      dark:text-gray-500
                    "
                  >
                    {payment.store_product_name
                      || t(
                        'recent.productPurchase',
                        'Product Purchase',
                      )}

                    {' • #'}

                    {payment.id}
                  </p>

                  <div
                    className="
                      mt-1
                      flex
                      items-center
                      justify-between
                    "
                  >
                    <p
                      className="
                        text-[11px]
                        text-gray-400
                        dark:text-gray-550
                      "
                    >
                      {t(
                        'recent.base',
                        {
                          symbol: '',
                          amount:
                            formatAmount(
                              payment.base_price,
                              payment.currency,
                            ),
                        },
                      )}
                    </p>

                    {getStatusBadge(
                      payment.status,
                    )}
                  </div>

                  <div
                    className="
                      mt-1
                      flex
                      items-center
                      justify-between
                      text-[10px]
                      text-gray-400
                      dark:text-gray-500
                    "
                  >
                    <span>
                      {formatDate(
                        payment.created_at,
                      )}
                    </span>

                    {payment.profit_percentage
                      > 0 && (
                      <span
                        className="
                          font-medium
                          text-green-500
                        "
                      >
                        {t(
                          'recent.profit',
                          {
                            percent:
                              payment.profit_percentage,
                            defaultValue:
                              `+${payment.profit_percentage}% profit`,
                          },
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {payments.length > 0 && (
        <div
          className="
            mt-4
            flex
            flex-col
            gap-2
            border-t
            border-gray-100
            pt-3
            dark:border-gray-700
          "
        >
          <button
            type="button"
            onClick={
              handleViewAllPayments
            }
            className="
              w-full
              rounded-xl
              py-2
              text-xs
              font-bold
              text-white
              shadow-sm
              transition
              hover:opacity-90
            "
            style={{
              backgroundColor:
                currentColor,
            }}
          >
            {t(
              'recent.buttons.viewAll',
              'View All Payments',
            )}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            className="
              w-full
              rounded-xl
              border
              border-gray-200
              py-2
              text-xs
              font-bold
              text-gray-500
              transition
              hover:bg-gray-50
              dark:border-gray-700
              dark:text-gray-300
              dark:hover:bg-gray-800
            "
          >
            {t(
              'recent.buttons.refresh',
              'Refresh',
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default Payments;