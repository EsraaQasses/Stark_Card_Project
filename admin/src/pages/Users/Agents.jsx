import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const PAGE_SIZE = 12;

const normalizeList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
};

const getAgentName = (agent, isArabic) => (
  agent?.full_name
  || agent?.username
  || (
    isArabic
      ? `الوكيل #${agent?.id ?? ''}`
      : `Agent #${agent?.id ?? ''}`
  )
);

const getInitials = (name) => {
  const value = String(name || '').trim();

  if (!value) {
    return 'AG';
  }

  const parts = value
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
};

const Agents = () => {
  const navigate = useNavigate();

  const {
    i18n,
  } = useTranslation();

  const {
    currentColor,
  } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    category: isArabic
      ? 'إدارة المستخدمين'
      : 'User Management',

    title: isArabic
      ? 'الوكلاء'
      : 'Agents',

    subtitle: isArabic
      ? 'اختر الوكيل لعرض ملفه الكامل والعملاء والعمولة والأرصدة.'
      : 'Choose an agent to view the full profile, customers, commission, and balances.',

    refresh: isArabic
      ? 'تحديث البيانات'
      : 'Refresh',

    searchPlaceholder: isArabic
      ? 'ابحث باسم الوكيل أو رقم ID...'
      : 'Search by agent name or ID...',

    totalAgents: isArabic
      ? 'إجمالي الوكلاء'
      : 'Total agents',

    shownAgents: isArabic
      ? 'النتائج الظاهرة'
      : 'Visible results',

    openProfile: isArabic
      ? 'فتح ملف الوكيل'
      : 'Open agent profile',

    loading: isArabic
      ? 'جاري تحميل الوكلاء...'
      : 'Loading agents...',

    empty: isArabic
      ? 'لا يوجد وكلاء مطابقون للبحث.'
      : 'No agents match your search.',

    loadFailed: isArabic
      ? 'تعذر تحميل قائمة الوكلاء.'
      : 'Failed to load agents.',

    page: isArabic
      ? 'صفحة'
      : 'Page',

    of: isArabic
      ? 'من'
      : 'of',
  }), [isArabic]);

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchAgents = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await axiosInstance.get(
          '/agents/agents/',
        );

        setAgents(
          normalizeList(response.data),
        );
      } catch (loadError) {
        console.error(
          'Error loading agents:',
          loadError,
        );

        setError(
          loadError?.response?.data?.error
          || loadError?.response?.data?.detail
          || labels.loadFailed,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [labels.loadFailed],
  );

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredAgents = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return agents;
    }

    return agents.filter((agent) => {
      const values = [
        agent?.id,
        agent?.username,
        agent?.full_name,
        agent?.agent_code,
      ];

      return values.some((value) => (
        value !== null
        && value !== undefined
        && String(value)
          .toLowerCase()
          .includes(query)
      ));
    });
  }, [
    agents,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAgents.length / PAGE_SIZE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const visibleAgents = useMemo(() => {
    const start = (
      currentPage - 1
    ) * PAGE_SIZE;

    return filteredAgents.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [
    currentPage,
    filteredAgents,
  ]);

  const openAgent = (agent) => {
    navigate(
      `/agents/${agent.id}`,
      {
        state: {
          agent,
        },
      },
    );
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
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
          space-y-5
        "
      >
        <section
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-slate-100
            bg-white
            px-5
            py-6
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-7
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -start-24
              -top-28
              h-64
              w-64
              rounded-full
              opacity-[0.08]
            "
            style={{
              backgroundColor: accentColor,
            }}
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-24
              end-10
              h-48
              w-48
              rounded-full
              opacity-[0.04]
            "
            style={{
              backgroundColor: accentColor,
            }}
          />

          <div
            className="
              relative
              z-10
              flex
              flex-col
              gap-6
              xl:flex-row
              xl:items-end
              xl:justify-between
            "
          >
            <div className="max-w-2xl text-start">
              <div
                className="
                  mb-3
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
                    backgroundColor: accentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-extrabold
                  "
                  style={{
                    color: accentColor,
                  }}
                >
                  {labels.category}
                </span>
              </div>

              <h1
                className="
                  text-3xl
                  font-black
                  tracking-tight
                  text-slate-950
                  dark:text-white
                  md:text-4xl
                "
              >
                {labels.title}
              </h1>

              <p
                className="
                  mt-2
                  max-w-xl
                  text-sm
                  font-medium
                  leading-7
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {labels.subtitle}
              </p>
            </div>

            <div
              className="
                flex
                w-full
                flex-col
                gap-3
                sm:flex-row
                xl:w-auto
              "
            >
              <div
                className="
                  relative
                  min-w-0
                  flex-1
                  xl:w-[360px]
                "
              >
                <FiSearch
                  className="
                    pointer-events-none
                    absolute
                    start-4
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => (
                    setSearch(
                      event.target.value,
                    )
                  )}
                  placeholder={labels.searchPlaceholder}
                  className="
                    h-12
                    w-full
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    ps-11
                    pe-4
                    text-sm
                    font-semibold
                    text-slate-900
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-slate-300
                    focus:ring-4
                    focus:ring-slate-100
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-white
                    dark:focus:ring-slate-800
                  "
                />
              </div>

              <button
                type="button"
                disabled={refreshing}
                onClick={() => (
                  fetchAgents({
                    background: true,
                  })
                )}
                className="
                  flex
                  h-12
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  px-5
                  text-sm
                  font-extrabold
                  text-white
                  shadow-sm
                  transition
                  hover:opacity-90
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
                style={{
                  backgroundColor: accentColor,
                }}
              >
                <FiRefreshCw
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                />

                {labels.refresh}
              </button>
            </div>
          </div>
        </section>

        <section
          className="
            grid
            gap-3
            sm:grid-cols-2
          "
        >
          <div
            className="
              flex
              items-center
              gap-4
              rounded-2xl
              border
              border-slate-100
              bg-white
              p-4
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
              "
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiShield className="text-xl" />
            </div>

            <div className="text-start">
              <p
                className="
                  text-xs
                  font-bold
                  text-slate-400
                "
              >
                {labels.totalAgents}
              </p>

              <p
                className="
                  mt-0.5
                  text-2xl
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {agents.length}
              </p>
            </div>
          </div>

          <div
            className="
              flex
              items-center
              gap-4
              rounded-2xl
              border
              border-slate-100
              bg-white
              p-4
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
              "
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiUsers className="text-xl" />
            </div>

            <div className="text-start">
              <p
                className="
                  text-xs
                  font-bold
                  text-slate-400
                "
              >
                {labels.shownAgents}
              </p>

              <p
                className="
                  mt-0.5
                  text-2xl
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {filteredAgents.length}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div
            className="
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-bold
              text-red-700
              dark:border-red-900/40
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            {error}
          </div>
        )}

        <section
          className="
            rounded-3xl
            border
            border-slate-100
            bg-white
            p-4
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            sm:p-5
          "
        >
          {loading ? (
            <div
              className="
                flex
                min-h-[360px]
                flex-col
                items-center
                justify-center
                gap-3
                text-slate-400
              "
            >
              <FiRefreshCw
                className="
                  animate-spin
                  text-3xl
                "
              />

              <p className="text-sm font-bold">
                {labels.loading}
              </p>
            </div>
          ) : visibleAgents.length === 0 ? (
            <div
              className="
                flex
                min-h-[320px]
                flex-col
                items-center
                justify-center
                gap-4
                text-center
              "
            >
              <div
                className="
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                "
                style={{
                  backgroundColor: `${accentColor}12`,
                  color: accentColor,
                }}
              >
                <FiShield className="text-2xl" />
              </div>

              <p
                className="
                  text-sm
                  font-bold
                  text-slate-400
                "
              >
                {labels.empty}
              </p>
            </div>
          ) : (
            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                xl:grid-cols-3
              "
            >
              {visibleAgents.map((agent) => {
                const name = getAgentName(
                  agent,
                  isArabic,
                );

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => (
                      openAgent(agent)
                    )}
                    className="
                      group
                      relative
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-100
                      bg-slate-50/70
                      p-4
                      text-start
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-slate-200
                      hover:bg-white
                      hover:shadow-md
                      dark:border-slate-700
                      dark:bg-slate-900/40
                      dark:hover:border-slate-600
                      dark:hover:bg-slate-900
                    "
                  >
                    <div
                      className="
                        absolute
                        inset-y-0
                        start-0
                        w-1
                        opacity-0
                        transition-opacity
                        group-hover:opacity-100
                      "
                      style={{
                        backgroundColor: accentColor,
                      }}
                    />

                    <div
                      className="
                        flex
                        items-center
                        gap-4
                      "
                    >
                      <div
                        className="
                          flex
                          h-12
                          w-12
                          shrink-0
                          items-center
                          justify-center
                          rounded-2xl
                          text-sm
                          font-black
                          text-white
                          shadow-sm
                        "
                        style={{
                          backgroundColor: accentColor,
                        }}
                      >
                        {getInitials(name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className="
                            truncate
                            text-base
                            font-black
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {name}
                        </p>

                        <div
                          className="
                            mt-1.5
                            flex
                            items-center
                            gap-2
                          "
                        >
                          <span
                            className="
                              rounded-lg
                              bg-white
                              px-2
                              py-1
                              text-xs
                              font-extrabold
                              text-slate-500
                              shadow-sm
                              dark:bg-slate-800
                              dark:text-slate-300
                            "
                            dir="ltr"
                          >
                            #{agent.id}
                          </span>
                        </div>
                      </div>

                      <div
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-white
                          text-slate-400
                          shadow-sm
                          transition
                          group-hover:text-slate-700
                          dark:bg-slate-800
                          dark:group-hover:text-white
                        "
                      >
                        {isArabic
                          ? <FiChevronLeft />
                          : <FiChevronRight />}
                      </div>
                    </div>

                    <div
                      className="
                        mt-4
                        flex
                        items-center
                        justify-between
                        border-t
                        border-slate-100
                        pt-3
                        dark:border-slate-700
                      "
                    >
                      <span
                        className="
                          text-xs
                          font-bold
                          text-slate-400
                        "
                      >
                        {labels.openProfile}
                      </span>

                      <span
                        className="
                          text-xs
                          font-black
                        "
                        style={{
                          color: accentColor,
                        }}
                      >
                        {isArabic ? 'عرض ←' : 'View →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!loading
          && filteredAgents.length > 0
          && totalPages > 1 && (
          <section
            className="
              flex
              flex-col
              gap-3
              rounded-2xl
              border
              border-slate-100
              bg-white
              px-4
              py-3
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <p
              className="
                text-sm
                font-bold
                text-slate-500
                dark:text-slate-400
              "
            >
              {labels.page}{' '}
              <span
                className="
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {currentPage}
              </span>{' '}
              {labels.of}{' '}
              <span
                className="
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {totalPages}
              </span>
            </p>

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => (
                  setPage(
                    (previous) => Math.max(
                      1,
                      previous - 1,
                    ),
                  )
                )}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-300
                "
              >
                {isArabic
                  ? <FiChevronRight />
                  : <FiChevronLeft />}
              </button>

              <div
                className="
                  min-w-[72px]
                  rounded-xl
                  px-3
                  py-2
                  text-center
                  text-sm
                  font-black
                  text-white
                "
                style={{
                  backgroundColor: accentColor,
                }}
              >
                {currentPage} / {totalPages}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => (
                  setPage(
                    (previous) => Math.min(
                      totalPages,
                      previous + 1,
                    ),
                  )
                )}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-300
                "
              >
                {isArabic
                  ? <FiChevronLeft />
                  : <FiChevronRight />}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Agents;