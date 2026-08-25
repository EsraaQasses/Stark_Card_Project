import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiMapPin,
  FiPackage,
  FiPercent,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { localizeRuntimeValue } from '../../utils/runtimeLocalization';
import { useStateContext } from '../../contexts/ContextProvider';

const listFrom = (data) => (
  Array.isArray(data)
    ? data
    : data?.results || []
);

const messageFrom = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.detail
  || fallback
);

const inputClass = `
  w-full
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3.5
  py-2.5
  text-sm
  text-slate-900
  outline-none
  transition-all
  duration-200
  placeholder:text-slate-400
  focus:border-cyan-400
  focus:ring-2
  focus:ring-cyan-100
  disabled:cursor-not-allowed
  disabled:opacity-60
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-cyan-900/30
`;

const AgentOperations = () => {
  const {
    t,
    i18n,
  } = useTranslation([
    'agents',
    'common',
  ]);

  const {
    currentColor,
  } = useStateContext();

  const [tab, setTab] = useState('assignments');

  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [cashouts, setCashouts] = useState([]);
  const [cashoutPage, setCashoutPage] = useState(1);
  const [cashoutCount, setCashoutCount] = useState(0);
  const [cashoutNext, setCashoutNext] = useState(false);
  const [cashoutPrevious, setCashoutPrevious] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState('');

  const [assignmentForm, setAssignmentForm] = useState({
    agent: '',
    product: '',
    commission_percent: '',
    is_active: true,
  });

  const [regionForm, setRegionForm] = useState({
    agent_id: '',
    region: '',
  });

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
  );

  const cashoutStatusLabel = (status) => (
    localizeRuntimeValue({
      t,
      i18n,
      value: status,
      namespace: 'agents',
      prefix: 'status',
      aliases: {
        success: 'approved',
        successful: 'approved',
        canceled: 'cancelled',
        processing: 'pending',
      },
      fallback: () => (
        t('status.unknown')
      ),
    })
  );

  // ====================================================
  // Load Core
  // ====================================================

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        agentResponse,
        productResponse,
        assignmentResponse,
      ] = await Promise.all([
        axiosInstance.get(
          '/agents/agents/',
        ),
        axiosInstance.get(
          '/store/admin/products/',
        ),
        axiosInstance.get(
          '/agents/agent-product-assignments/',
        ),
      ]);

      setAgents(
        listFrom(agentResponse.data),
      );

      setProducts(
        listFrom(productResponse.data),
      );

      setAssignments(
        listFrom(assignmentResponse.data),
      );
    } catch (loadError) {
      setError(
        messageFrom(
          loadError,
          t('operations.errors.load'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ====================================================
  // Cashouts
  // ====================================================

  const loadCashouts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page: cashoutPage,
      };

      if (cashoutStatus) {
        params.status = cashoutStatus;
      }

      const response = await axiosInstance.get(
        '/agents/admin/cashout/',
        {
          params,
        },
      );

      setCashouts(
        listFrom(response.data),
      );

      setCashoutCount(
        response.data?.count
        ?? listFrom(response.data).length,
      );

      setCashoutNext(
        Boolean(response.data?.next),
      );

      setCashoutPrevious(
        Boolean(response.data?.previous),
      );
    } catch (loadError) {
      setError(
        messageFrom(
          loadError,
          t(
            'operations.errors.loadCashouts',
          ),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    cashoutPage,
    cashoutStatus,
    t,
  ]);

  useEffect(() => {
    if (tab === 'cashouts') {
      loadCashouts();
    } else {
      loadCore();
    }
  }, [
    loadCashouts,
    loadCore,
    tab,
  ]);

  // ====================================================
  // Agent Map
  // ====================================================

  const agentById = useMemo(
    () => (
      new Map(
        agents.map((agent) => [
          String(agent.id),
          agent,
        ]),
      )
    ),
    [agents],
  );

  // ====================================================
  // Create Assignment
  // ====================================================

  const createAssignment = async (event) => {
    event.preventDefault();

    if (mutating) {
      return;
    }

    const commission = Number(
      assignmentForm.commission_percent,
    );

    if (
      !assignmentForm.agent
      || !assignmentForm.product
      || !Number.isFinite(commission)
      || commission < 0
      || commission >= 100
    ) {
      setError(
        t(
          'operations.validation.assignment',
        ),
      );

      return;
    }

    setMutating('assignment-create');

    setError('');
    setNotice('');

    try {
      await axiosInstance.post(
        '/agents/agent-product-assignments/',
        {
          agent: Number(
            assignmentForm.agent,
          ),

          product: Number(
            assignmentForm.product,
          ),

          commission_percent:
            commission,

          is_active:
            assignmentForm.is_active,
        },
      );

      setAssignmentForm({
        agent: '',
        product: '',
        commission_percent: '',
        is_active: true,
      });

      setNotice(
        t(
          'operations.notices.assignmentSaved',
        ),
      );

      await loadCore();
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          t(
            'operations.errors.saveAssignment',
          ),
        ),
      );
    } finally {
      setMutating('');
    }
  };

  // ====================================================
  // Assignment Update
  // ====================================================

  const toggleAssignment = async (assignment) => {
    if (mutating) {
      return;
    }

    setMutating(
      `assignment-${assignment.id}`,
    );

    setError('');
    setNotice('');

    try {
      await axiosInstance.patch(
        `/agents/agent-product-assignments/${assignment.id}/`,
        {
          is_active:
            !assignment.is_active,
        },
      );

      setNotice(
        t(
          'operations.notices.assignmentUpdated',
        ),
      );

      await loadCore();
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          t(
            'operations.errors.updateAssignment',
          ),
        ),
      );
    } finally {
      setMutating('');
    }
  };

  const deactivateAssignment = async (assignment) => {
    if (
      mutating
      || !window.confirm(
        t(
          'operations.confirm.deactivateAssignment',
          {
            product:
              assignment.product_name
              || t(
                'operations.labels.productNumber',
                {
                  id: assignment.product,
                },
              ),
          },
        ),
      )
    ) {
      return;
    }

    setMutating(
      `assignment-${assignment.id}`,
    );

    setError('');
    setNotice('');

    try {
      await axiosInstance.delete(
        `/agents/agent-product-assignments/${assignment.id}/`,
      );

      setNotice(
        t(
          'operations.notices.assignmentDeactivated',
        ),
      );

      await loadCore();
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          t(
            'operations.errors.deactivateAssignment',
          ),
        ),
      );
    } finally {
      setMutating('');
    }
  };

  // ====================================================
  // Regions
  // ====================================================

  const saveRegion = async (event) => {
    event.preventDefault();

    if (
      mutating
      || !regionForm.agent_id
      || !regionForm.region.trim()
    ) {
      return;
    }

    setMutating('region');

    setError('');
    setNotice('');

    try {
      await axiosInstance.post(
        '/agents/regions/',
        {
          agent_id: Number(
            regionForm.agent_id,
          ),

          region:
            regionForm.region.trim(),
        },
      );

      setNotice(
        t(
          'operations.notices.regionSaved',
        ),
      );

      setRegionForm({
        agent_id: '',
        region: '',
      });

      await loadCore();
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          t(
            'operations.errors.saveRegion',
          ),
        ),
      );
    } finally {
      setMutating('');
    }
  };

  const clearRegion = async (agent) => {
    if (
      mutating
      || !window.confirm(
        t(
          'operations.confirm.removeRegion',
          {
            agent:
              agent.full_name
              || agent.username
              || t(
                'operations.labels.agentNumber',
                {
                  id: agent.id,
                },
              ),
          },
        ),
      )
    ) {
      return;
    }

    setMutating(
      `region-${agent.id}`,
    );

    setError('');
    setNotice('');

    try {
      await axiosInstance.delete(
        `/agents/regions/${agent.id}/`,
      );

      setNotice(
        t(
          'operations.notices.regionRemoved',
        ),
      );

      await loadCore();
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          t(
            'operations.errors.removeRegion',
          ),
        ),
      );
    } finally {
      setMutating('');
    }
  };

  const selectRegionAgent = (agentId) => {
    const agent = agentById.get(
      String(agentId),
    );

    setRegionForm({
      agent_id: agentId,
      region: agent?.region || '',
    });
  };

  const assignmentHeaders = [
    'agent',
    'product',
    'commission',
    'status',
    'actions',
  ];

  const regionHeaders = [
    'agent',
    'code',
    'region',
    'action',
  ];

  const cashoutHeaders = [
    'id',
    'customer',
    'agent',
    'amount',
    'status',
    'created',
  ];

  const handleRefresh = () => {
    if (tab === 'cashouts') {
      loadCashouts();
    } else {
      loadCore();
    }
  };

  return (
    <div
      className="
        mt-20
        px-3
        py-4
        sm:px-5
        md:mt-4
        md:px-8
        md:py-6
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          space-y-6
        "
      >
        {/* =========================================
            HEADER
        ========================================= */}

        <section
          className="
            relative
            overflow-hidden
            rounded-2xl
            border
            border-slate-100
            bg-white
            px-5
            py-5
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-6
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -start-16
              -top-20
              h-52
              w-52
              rounded-full
              opacity-[0.07]
            "
            style={{
              backgroundColor: currentColor,
            }}
          />

          <div
            className="
              relative
              z-10
              flex
              flex-col
              justify-between
              gap-5
              sm:flex-row
              sm:items-center
            "
          >
            <div className="text-start">
              <div
                className="
                  mb-2
                  flex
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-bold
                    md:text-base
                  "
                  style={{
                    color: currentColor,
                  }}
                >
                  {t(
                    'operations.category',
                  )}
                </span>
              </div>

              <h1
                className="
                  text-2xl
                  font-extrabold
                  tracking-tight
                  text-slate-900
                  dark:text-white
                  md:text-3xl
                  lg:text-4xl
                "
              >
                {t(
                  'operations.title',
                )}
              </h1>

              <p
                className="
                  mt-2
                  max-w-2xl
                  text-sm
                  leading-6
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {t(
                  'operations.subtitle',
                )}
              </p>

              <div
                className="
                  mt-4
                  flex
                  items-center
                  gap-1.5
                "
              >
                <span
                  className="h-1 w-14 rounded-full"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-6
                    rounded-full
                    opacity-60
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-2
                    rounded-full
                    opacity-30
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              style={{
                backgroundColor: currentColor,
              }}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                px-5
                py-2.5
                text-sm
                font-bold
                text-white
                shadow-md
                transition-all
                duration-200
                hover:opacity-90
                hover:shadow-lg
                active:scale-95
                disabled:opacity-60
                sm:w-auto
              "
            >
              <FiRefreshCw
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />

              {t(
                'operations.buttons.refresh',
              )}
            </button>
          </div>
        </section>

        {/* =========================================
            TABS
        ========================================= */}

        <div className="flex justify-start">
          <div
            className="
              inline-flex
              flex-wrap
              items-center
              gap-1
              rounded-xl
              border
              border-slate-200
              bg-slate-100
              p-1
              dark:border-slate-700
              dark:bg-slate-800
            "
          >
            {[
              'assignments',
              'regions',
              'cashouts',
            ].map((value) => {
              const active = tab === value;

              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setTab(value);
                    setError('');
                    setNotice('');
                  }}
                  style={
                    active
                      ? {
                          backgroundColor: currentColor,
                        }
                      : undefined
                  }
                  className={`
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    px-4
                    py-2
                    text-sm
                    font-bold
                    transition-all
                    duration-200

                    ${
                      active
                        ? 'text-white shadow-sm'
                        : `
                          text-slate-500
                          hover:bg-white
                          hover:text-slate-800
                          dark:text-slate-400
                          dark:hover:bg-slate-700
                          dark:hover:text-white
                        `
                    }
                  `}
                >
                  {value === 'assignments' && (
                    <FiPackage />
                  )}

                  {value === 'regions' && (
                    <FiMapPin />
                  )}

                  {value === 'cashouts' && (
                    <FiDollarSign />
                  )}

                  {t(
                    `operations.tabs.${value}`,
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================
            NOTICE
        ========================================= */}

        {notice && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-4
              py-3.5
              text-sm
              text-emerald-800
              dark:border-emerald-900
              dark:bg-emerald-950/30
              dark:text-emerald-300
            "
          >
            <FiCheckCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {notice}
            </span>

            <button
              type="button"
              onClick={() => setNotice('')}
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =========================================
            ERROR
        ========================================= */}

        {error && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3.5
              text-sm
              text-red-700
              dark:border-red-900
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError('')}
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =========================================
            ASSIGNMENTS
        ========================================= */}

        {tab === 'assignments' && (
          <div
            className="
              grid
              gap-6
              xl:grid-cols-[380px_minmax(0,1fr)]
            "
          >
            <form
              onSubmit={createAssignment}
              className="
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-5
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  mb-5
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                  "
                  style={{
                    color: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }}
                >
                  <FiPackage />
                </div>

                <h2
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    'operations.assignments.title',
                  )}
                </h2>
              </div>

              <div className="space-y-4">
                <label
                  className="
                    block
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.assignments.agent',
                  )}

                  <select
                    className={`${inputClass} mt-2`}
                    value={assignmentForm.agent}
                    onChange={(event) => (
                      setAssignmentForm({
                        ...assignmentForm,
                        agent:
                          event.target.value,
                      })
                    )}
                    required
                  >
                    <option value="">
                      {t(
                        'operations.assignments.selectAgent',
                      )}
                    </option>

                    {agents.map((agent) => (
                      <option
                        key={agent.id}
                        value={agent.id}
                      >
                        {agent.full_name
                          || agent.username
                          || t(
                            'operations.labels.agentNumber',
                            {
                              id: agent.id,
                            },
                          )}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className="
                    block
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.assignments.product',
                  )}

                  <select
                    className={`${inputClass} mt-2`}
                    value={assignmentForm.product}
                    onChange={(event) => (
                      setAssignmentForm({
                        ...assignmentForm,
                        product:
                          event.target.value,
                      })
                    )}
                    required
                  >
                    <option value="">
                      {t(
                        'operations.assignments.selectProduct',
                      )}
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name
                          || product.name_en
                          || product.title
                          || t(
                            'operations.labels.productNumber',
                            {
                              id: product.id,
                            },
                          )}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className="
                    block
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.assignments.commission',
                  )}

                  <div className="relative mt-2">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.01"
                      value={
                        assignmentForm.commission_percent
                      }
                      onChange={(event) => (
                        setAssignmentForm({
                          ...assignmentForm,
                          commission_percent:
                            event.target.value,
                        })
                      )}
                      required
                    />

                    <FiPercent
                      className="
                        pointer-events-none
                        absolute
                        end-3
                        top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />
                  </div>
                </label>

                <label
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-2
                    rounded-xl
                    bg-slate-50
                    p-3
                    text-sm
                    font-semibold
                    text-slate-700
                    dark:bg-slate-800/50
                    dark:text-slate-200
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      assignmentForm.is_active
                    }
                    onChange={(event) => (
                      setAssignmentForm({
                        ...assignmentForm,
                        is_active:
                          event.target.checked,
                      })
                    )}
                  />

                  {t(
                    'operations.assignments.active',
                  )}
                </label>

                <button
                  type="submit"
                  disabled={Boolean(mutating)}
                  style={{
                    backgroundColor: currentColor,
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white
                    shadow-sm
                    transition-all
                    hover:opacity-90
                    hover:shadow-md
                    disabled:opacity-50
                  "
                >
                  {mutating === 'assignment-create' && (
                    <FiRefreshCw
                      className="animate-spin"
                    />
                  )}

                  {mutating === 'assignment-create'
                    ? t(
                        'operations.buttons.saving',
                      )
                    : t(
                        'operations.buttons.saveAssignment',
                      )}
                </button>
              </div>
            </form>

            <section
              className="
                min-w-0
                overflow-hidden
                rounded-2xl
                border
                border-slate-100
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                  border-b
                  border-slate-100
                  px-5
                  py-4
                  dark:border-slate-800
                "
              >
                <FiPackage
                  style={{
                    color: currentColor,
                  }}
                />

                <h2
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    'operations.tabs.assignments',
                  )}
                </h2>
              </div>

              {loading ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                  "
                >
                  <FiRefreshCw
                    className="
                      animate-spin
                      text-3xl
                      text-slate-400
                    "
                  />
                </div>
              ) : assignments.length === 0 ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                    text-slate-500
                  "
                >
                  {t(
                    'operations.assignments.empty',
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="
                      min-w-full
                      divide-y
                      divide-slate-100
                      text-sm
                      dark:divide-slate-800
                    "
                  >
                    <thead
                      className="
                        bg-slate-50
                        dark:bg-slate-900/60
                      "
                    >
                      <tr>
                        {assignmentHeaders.map(
                          (heading) => (
                            <th
                              key={heading}
                              className="
                                whitespace-nowrap
                                px-4
                                py-3.5
                                text-start
                                text-xs
                                font-bold
                                text-slate-500
                                dark:text-slate-400
                              "
                            >
                              {t(
                                `operations.headers.${heading}`,
                              )}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody
                      className="
                        divide-y
                        divide-slate-100
                        dark:divide-slate-800
                      "
                    >
                      {assignments.map(
                        (assignment) => (
                          <tr
                            key={assignment.id}
                            className="
                              hover:bg-slate-50/70
                              dark:hover:bg-slate-800/40
                            "
                          >
                            <td
                              className="
                                px-4
                                py-4
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {assignment.agent_name
                                || t(
                                  'operations.labels.agentNumber',
                                  {
                                    id:
                                      assignment.agent,
                                  },
                                )}
                            </td>

                            <td
                              className="
                                px-4
                                py-4
                                text-slate-700
                                dark:text-slate-200
                              "
                            >
                              {assignment.product_name
                                || t(
                                  'operations.labels.productNumber',
                                  {
                                    id:
                                      assignment.product,
                                  },
                                )}
                            </td>

                            <td
                              className="
                                px-4
                                py-4
                                font-bold
                                text-slate-700
                                dark:text-slate-200
                              "
                            >
                              {assignment.commission_percent}%
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`
                                  rounded-full
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-bold

                                  ${
                                    assignment.is_active
                                      ? `
                                        bg-emerald-50
                                        text-emerald-700
                                      `
                                      : `
                                        bg-slate-100
                                        text-slate-500
                                      `
                                  }
                                `}
                              >
                                {assignment.is_active
                                  ? t('status.active')
                                  : t('status.inactive')}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2
                                "
                              >
                                <button
                                  type="button"
                                  disabled={Boolean(mutating)}
                                  onClick={() => (
                                    toggleAssignment(
                                      assignment,
                                    )
                                  )}
                                  style={{
                                    color: currentColor,
                                  }}
                                  className="
                                    rounded-lg
                                    border
                                    border-slate-200
                                    px-3
                                    py-2
                                    text-xs
                                    font-bold
                                    disabled:opacity-50
                                  "
                                >
                                  {assignment.is_active
                                    ? t(
                                        'operations.buttons.disable',
                                      )
                                    : t(
                                        'operations.buttons.enable',
                                      )}
                                </button>

                                {assignment.is_active && (
                                  <button
                                    type="button"
                                    disabled={
                                      Boolean(mutating)
                                    }
                                    onClick={() => (
                                      deactivateAssignment(
                                        assignment,
                                      )
                                    )}
                                    className="
                                      flex
                                      items-center
                                      gap-1
                                      rounded-lg
                                      border
                                      border-red-100
                                      px-3
                                      py-2
                                      text-xs
                                      font-bold
                                      text-red-600
                                      disabled:opacity-50
                                    "
                                  >
                                    <FiTrash2 />

                                    {t(
                                      'operations.buttons.remove',
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================
            REGIONS
        ========================================= */}

        {tab === 'regions' && (
          <div
            className="
              grid
              gap-6
              xl:grid-cols-[380px_minmax(0,1fr)]
            "
          >
            <form
              onSubmit={saveRegion}
              className="
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-5
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  mb-5
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                  "
                  style={{
                    color: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }}
                >
                  <FiMapPin />
                </div>

                <h2
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    'operations.regions.title',
                  )}
                </h2>
              </div>

              <div className="space-y-4">
                <label
                  className="
                    block
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.assignments.agent',
                  )}

                  <select
                    className={`${inputClass} mt-2`}
                    value={regionForm.agent_id}
                    onChange={(event) => (
                      selectRegionAgent(
                        event.target.value,
                      )
                    )}
                    required
                  >
                    <option value="">
                      {t(
                        'operations.assignments.selectAgent',
                      )}
                    </option>

                    {agents.map((agent) => (
                      <option
                        key={agent.id}
                        value={agent.id}
                      >
                        {agent.full_name
                          || agent.username
                          || t(
                            'operations.labels.agentNumber',
                            {
                              id: agent.id,
                            },
                          )}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className="
                    block
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.regions.region',
                  )}

                  <input
                    className={`${inputClass} mt-2`}
                    maxLength="255"
                    value={regionForm.region}
                    onChange={(event) => (
                      setRegionForm({
                        ...regionForm,
                        region:
                          event.target.value,
                      })
                    )}
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    Boolean(mutating)
                    || !regionForm.region.trim()
                  }
                  style={{
                    backgroundColor: currentColor,
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white
                    shadow-sm
                    disabled:opacity-50
                  "
                >
                  {mutating === 'region' && (
                    <FiRefreshCw
                      className="animate-spin"
                    />
                  )}

                  {mutating === 'region'
                    ? t(
                        'operations.buttons.saving',
                      )
                    : t(
                        'operations.buttons.saveRegion',
                      )}
                </button>
              </div>
            </form>

            <section
              className="
                min-w-0
                overflow-hidden
                rounded-2xl
                border
                border-slate-100
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              {loading ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                  "
                >
                  <FiRefreshCw
                    className="
                      animate-spin
                      text-3xl
                      text-slate-400
                    "
                  />
                </div>
              ) : agents.length === 0 ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                    text-slate-500
                  "
                >
                  {t(
                    'operations.regions.empty',
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="
                      min-w-full
                      divide-y
                      divide-slate-100
                      text-sm
                      dark:divide-slate-800
                    "
                  >
                    <thead
                      className="
                        bg-slate-50
                        dark:bg-slate-900/60
                      "
                    >
                      <tr>
                        {regionHeaders.map(
                          (heading) => (
                            <th
                              key={heading}
                              className="
                                px-4
                                py-3.5
                                text-start
                                text-xs
                                font-bold
                                text-slate-500
                                dark:text-slate-400
                              "
                            >
                              {t(
                                `operations.headers.${heading}`,
                              )}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {agents.map((agent) => (
                        <tr
                          key={agent.id}
                          className="
                            border-t
                            border-slate-100
                            hover:bg-slate-50
                            dark:border-slate-800
                            dark:hover:bg-slate-800/40
                          "
                        >
                          <td
                            className="
                              px-4
                              py-4
                              font-bold
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {agent.full_name
                              || agent.username
                              || t(
                                'operations.labels.agentNumber',
                                {
                                  id: agent.id,
                                },
                              )}
                          </td>

                          <td
                            className="
                              px-4
                              py-4
                              text-slate-500
                            "
                            dir="ltr"
                          >
                            {agent.agent_code || '—'}
                          </td>

                          <td
                            className="
                              px-4
                              py-4
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            {agent.region
                              || t(
                                'operations.regions.notAssigned',
                              )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => (
                                  selectRegionAgent(
                                    String(agent.id),
                                  )
                                )}
                                style={{
                                  color: currentColor,
                                }}
                                className="
                                  rounded-lg
                                  border
                                  border-slate-200
                                  px-3
                                  py-2
                                  text-xs
                                  font-bold
                                "
                              >
                                {t(
                                  'operations.buttons.edit',
                                )}
                              </button>

                              {agent.region && (
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(mutating)
                                  }
                                  onClick={() => (
                                    clearRegion(agent)
                                  )}
                                  className="
                                    rounded-lg
                                    border
                                    border-red-100
                                    px-3
                                    py-2
                                    text-xs
                                    font-bold
                                    text-red-600
                                    disabled:opacity-50
                                  "
                                >
                                  {t(
                                    'operations.buttons.clear',
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================
            CASHOUTS
        ========================================= */}

        {tab === 'cashouts' && (
          <div className="space-y-6">
            <section
              className="
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-5
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  flex
                  flex-col
                  justify-between
                  gap-4
                  sm:flex-row
                  sm:items-end
                "
              >
                <label
                  className="
                    block
                    w-full
                    max-w-sm
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'operations.cashouts.status',
                  )}

                  <select
                    className={`${inputClass} mt-2`}
                    value={cashoutStatus}
                    onChange={(event) => {
                      setCashoutStatus(
                        event.target.value,
                      );

                      setCashoutPage(1);
                    }}
                  >
                    <option value="">
                      {t(
                        'operations.cashouts.allStatuses',
                      )}
                    </option>

                    {[
                      'pending',
                      'approved',
                      'rejected',
                      'cancelled',
                    ].map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {cashoutStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  {t(
                    'operations.cashouts.readOnlyHint',
                  )}
                </p>
              </div>
            </section>

            <section
              className="
                min-w-0
                overflow-hidden
                rounded-2xl
                border
                border-slate-100
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              {loading ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                  "
                >
                  <FiRefreshCw
                    className="
                      animate-spin
                      text-3xl
                      text-slate-400
                    "
                  />
                </div>
              ) : cashouts.length === 0 ? (
                <div
                  className="
                    flex
                    min-h-[300px]
                    items-center
                    justify-center
                    text-slate-500
                  "
                >
                  {t(
                    'operations.cashouts.empty',
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="
                      min-w-full
                      divide-y
                      divide-slate-100
                      text-sm
                      dark:divide-slate-800
                    "
                  >
                    <thead
                      className="
                        bg-slate-50
                        dark:bg-slate-900/60
                      "
                    >
                      <tr>
                        {cashoutHeaders.map(
                          (heading) => (
                            <th
                              key={heading}
                              className="
                                whitespace-nowrap
                                px-4
                                py-3.5
                                text-start
                                text-xs
                                font-bold
                                text-slate-500
                                dark:text-slate-400
                              "
                            >
                              {t(
                                `operations.headers.${heading}`,
                              )}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {cashouts.map((cashout) => (
                        <tr
                          key={cashout.id}
                          className="
                            border-t
                            border-slate-100
                            hover:bg-slate-50
                            dark:border-slate-800
                            dark:hover:bg-slate-800/40
                          "
                        >
                          <td
                            className="
                              px-4
                              py-4
                              text-slate-500
                            "
                            dir="ltr"
                          >
                            #{cashout.id}
                          </td>

                          <td className="px-4 py-4">
                            <p
                              className="
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {cashout.user_name
                                || t(
                                  'operations.labels.userNumber',
                                  {
                                    id:
                                      cashout.user_id
                                      || '—',
                                  },
                                )}
                            </p>

                            <p
                              className="
                                text-xs
                                text-slate-400
                              "
                              dir="ltr"
                            >
                              {cashout.user_phone || ''}
                            </p>
                          </td>

                          <td
                            className="
                              px-4
                              py-4
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            {cashout.agent_name
                              || t(
                                'operations.labels.agentNumber',
                                {
                                  id:
                                    cashout.agent_id
                                    || '—',
                                },
                              )}
                          </td>

                          <td
                            className="
                              px-4
                              py-4
                              font-bold
                              text-slate-900
                              dark:text-white
                            "
                          >
                            <bdi>
                              {cashout.amount}{' '}
                              {cashout.currency
                                || cashout.wallet_currency
                                || ''}
                            </bdi>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className="
                                rounded-full
                                bg-slate-100
                                px-2.5
                                py-1
                                text-xs
                                font-bold
                                text-slate-600
                                dark:bg-slate-800
                                dark:text-slate-300
                              "
                            >
                              {cashoutStatusLabel(
                                cashout.status,
                              )}
                            </span>
                          </td>

                          <td
                            className="
                              whitespace-nowrap
                              px-4
                              py-4
                              text-xs
                              text-slate-500
                            "
                          >
                            {cashout.created_at
                              ? new Date(
                                  cashout.created_at,
                                ).toLocaleString(
                                  locale,
                                )
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {!loading
              && (
                cashoutPrevious
                || cashoutNext
              ) && (
              <div
                className="
                  flex
                  flex-col
                  items-center
                  justify-between
                  gap-3
                  rounded-xl
                  border
                  border-slate-100
                  bg-white
                  px-4
                  py-3
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                  sm:flex-row
                "
              >
                <span
                  className="
                    text-sm
                    text-slate-500
                  "
                >
                  {t(
                    'operations.cashouts.count',
                    {
                      count: cashoutCount,
                    },
                  )}
                </span>

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <button
                    type="button"
                    disabled={!cashoutPrevious}
                    onClick={() => (
                      setCashoutPage(
                        (page) => Math.max(
                          1,
                          page - 1,
                        ),
                      )
                    )}
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-lg
                      border
                      border-slate-200
                      disabled:opacity-30
                    "
                  >
                    <FiChevronRight />
                  </button>

                  <span
                    className="
                      px-2
                      text-sm
                      font-bold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {t(
                      'operations.cashouts.page',
                      {
                        page: cashoutPage,
                      },
                    )}
                  </span>

                  <button
                    type="button"
                    disabled={!cashoutNext}
                    onClick={() => (
                      setCashoutPage(
                        (page) => page + 1,
                      )
                    )}
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-lg
                      border
                      border-slate-200
                      disabled:opacity-30
                    "
                  >
                    <FiChevronLeft />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentOperations;