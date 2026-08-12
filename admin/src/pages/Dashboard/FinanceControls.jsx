import React, { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';

const messageFrom = (error, fallback) => error?.response?.data?.error || error?.response?.data?.detail || error?.response?.data?.code || fallback;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white';
const money = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });

const CurrencyAmounts = ({ values }) => {
  const entries = Object.entries(values || {});
  if (!entries.length) return <span className="text-gray-400">—</span>;
  return <div className="space-y-1">{entries.map(([currency, amount]) => <div key={currency}><span className="font-bold">{money(amount)}</span> <span className="text-xs text-gray-500">{currency}</span></div>)}</div>;
};

const FinanceControls = () => {
  const [tab, setTab] = useState('rates');
  const [currentQuote, setCurrentQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);
  const [rateForm, setRateForm] = useState({ rate: '', activation_note: '' });
  const [reportForm, setReportForm] = useState({ period: 'daily', date: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const historyResponse = await axiosInstance.get('/wallets/exchange-rates/history/');
      const quotes = Array.isArray(historyResponse.data) ? historyResponse.data : historyResponse.data?.results || [];
      setHistory(quotes);
      try {
        const currentResponse = await axiosInstance.get('/wallets/exchange-rates/current/');
        setCurrentQuote(currentResponse.data);
        setRateForm((previous) => ({ ...previous, rate: previous.rate || String(currentResponse.data?.platform_buy_usd_rate_syp || currentResponse.data?.usd_to_syp || '') }));
      } catch (currentError) {
        if (currentError?.response?.status !== 503) throw currentError;
        setCurrentQuote(null);
      }
    } catch (loadError) {
      setError(messageFrom(loadError, 'Failed to load exchange-rate quotes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (params = reportForm) => {
    setLoading(true);
    setError('');
    try {
      const requestParams = { period: params.period };
      if (params.period === 'custom') {
        requestParams.start_date = params.start_date;
        requestParams.end_date = params.end_date;
      } else if (params.date) requestParams.date = params.date;
      const response = await axiosInstance.get('/finance/reports/financial/', { params: requestParams });
      setReport(response.data);
    } catch (loadError) {
      setError(messageFrom(loadError, 'Failed to load the financial report.'));
    } finally {
      setLoading(false);
    }
  }, [reportForm]);

  useEffect(() => {
    if (tab === 'rates') loadRates();
    else loadReport();
  }, [loadRates, loadReport, tab]);

  const activateQuote = async (event) => {
    event.preventDefault();
    if (mutating) return;
    const rate = Number(rateForm.rate);
    if (!Number.isFinite(rate) || rate <= 0 || !rateForm.activation_note.trim()) {
      setError('A positive exchange rate and activation note are required.');
      return;
    }
    if (!window.confirm(`Activate a new zero-spread USD/SYP quote at ${rate}? The current quote will be superseded.`)) return;
    setMutating(true);
    setError('');
    setNotice('');
    try {
      await axiosInstance.post('/wallets/exchange-rates/activate/', {
        platform_buy_usd_rate_syp: rate,
        platform_sell_usd_rate_syp: rate,
        activation_note: rateForm.activation_note.trim(),
        expected_current_quote_id: currentQuote?.quote_id ?? null,
      });
      setNotice('Exchange-rate quote activated successfully.');
      setRateForm((previous) => ({ ...previous, activation_note: '' }));
      await loadRates();
    } catch (saveError) {
      setError(messageFrom(saveError, saveError?.response?.status === 409 ? 'The active quote changed. Refresh and try again.' : 'Failed to activate the quote.'));
    } finally {
      setMutating(false);
    }
  };

  const submitReport = (event) => {
    event.preventDefault();
    if (reportForm.period === 'custom' && (!reportForm.start_date || !reportForm.end_date)) {
      setError('Start and end dates are required for a custom report.');
      return;
    }
    loadReport(reportForm);
  };

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Finance</p><h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Finance controls</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Activate immutable exchange-rate quotes and review historical accounting reports.</p></div><button type="button" onClick={tab === 'rates' ? loadRates : () => loadReport()} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Refresh</button></div>
      <div className="mb-5 flex gap-2 border-b border-gray-200 dark:border-gray-700">{[['rates', 'Exchange-rate quotes'], ['reports', 'Financial reports']].map(([value, label]) => <button type="button" key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2 text-sm font-bold ${tab === value ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>{label}</button>)}</div>
      {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === 'rates' && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><p className="text-xs font-semibold uppercase text-gray-500">Current active quote</p>{loading ? <p className="mt-3 text-gray-500">Loading…</p> : currentQuote ? <div className="mt-3"><p className="text-3xl font-extrabold text-gray-900 dark:text-white">{money(currentQuote.platform_buy_usd_rate_syp || currentQuote.usd_to_syp)} <span className="text-base">SYP</span></p><p className="mt-1 text-sm text-gray-500">Version {currentQuote.version} · Quote #{currentQuote.quote_id}</p><p className="mt-1 text-xs text-gray-500">Activated {currentQuote.effective_at ? new Date(currentQuote.effective_at).toLocaleString() : '—'}</p></div> : <p className="mt-3 text-sm font-semibold text-amber-600">No active exchange-rate quote.</p>}</section>
            <form onSubmit={activateQuote} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div><h2 className="font-bold text-gray-900 dark:text-white">Activate new quote</h2><p className="text-xs text-gray-500">The backend currently permits zero-spread quotes only, so buy and sell rates are submitted equally.</p></div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">USD to SYP rate<input className={`${inputClass} mt-1`} type="number" min="0.000001" step="0.000001" value={rateForm.rate} onChange={(event) => setRateForm({ ...rateForm, rate: event.target.value })} required /></label><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Activation note<textarea className={`${inputClass} mt-1`} rows="3" value={rateForm.activation_note} onChange={(event) => setRateForm({ ...rateForm, activation_note: event.target.value })} required /></label><button type="submit" disabled={mutating} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutating ? 'Activating…' : 'Activate quote'}</button></form>
          </div>
          <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"><div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700"><h2 className="font-bold text-gray-900 dark:text-white">Immutable quote history</h2></div>{loading ? <div className="p-10 text-center text-gray-500">Loading quote history…</div> : history.length === 0 ? <div className="p-10 text-center text-gray-500">No exchange-rate quotes exist.</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['Version', 'Rate', 'Status', 'Note', 'Created', 'Superseded'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{history.map((quote) => <tr key={quote.quote_id}><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">v{quote.version}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{money(quote.platform_buy_usd_rate_syp)} SYP</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${quote.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{quote.status}</span></td><td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-300">{quote.activation_note || '—'}</td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{quote.created_at ? new Date(quote.created_at).toLocaleString() : '—'}</td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{quote.superseded_at ? new Date(quote.superseded_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>}</section>
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <form onSubmit={submitReport} className="mb-5 grid gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50 md:grid-cols-4"><label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Period<select className={`${inputClass} mt-1`} value={reportForm.period} onChange={(event) => setReportForm({ ...reportForm, period: event.target.value })}>{['daily', 'weekly', 'monthly', 'custom'].map((period) => <option key={period} value={period}>{period}</option>)}</select></label>{reportForm.period === 'custom' ? <><label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Start date<input className={`${inputClass} mt-1`} type="date" value={reportForm.start_date} onChange={(event) => setReportForm({ ...reportForm, start_date: event.target.value })} required /></label><label className="text-sm font-semibold text-gray-700 dark:text-gray-200">End date<input className={`${inputClass} mt-1`} type="date" value={reportForm.end_date} onChange={(event) => setReportForm({ ...reportForm, end_date: event.target.value })} required /></label></> : <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Anchor date (optional)<input className={`${inputClass} mt-1`} type="date" value={reportForm.date} onChange={(event) => setReportForm({ ...reportForm, date: event.target.value })} /></label>}<div className="flex items-end"><button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Loading…' : 'Run report'}</button></div></form>
          {loading ? <div className="p-10 text-center text-gray-500">Loading financial report…</div> : !report ? <div className="rounded-xl border border-gray-200 p-10 text-center text-gray-500 dark:border-gray-700">No report loaded.</div> : <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-semibold uppercase text-indigo-600">Operations</p><p className="text-2xl font-extrabold text-indigo-900">{report.operation_count ?? 0}</p></div><div className="rounded-xl bg-green-50 p-4"><p className="text-xs font-semibold uppercase text-green-600">Period</p><p className="text-lg font-extrabold capitalize text-green-900">{report.period}</p></div><div className="rounded-xl bg-gray-100 p-4"><p className="text-xs font-semibold uppercase text-gray-600">Boundary</p><p className="text-xs font-bold text-gray-900">{report.boundary?.start_inclusive ? new Date(report.boundary.start_inclusive).toLocaleString() : '—'}</p><p className="text-xs text-gray-600">to {report.boundary?.end_exclusive ? new Date(report.boundary.end_exclusive).toLocaleString() : '—'}</p></div></div><section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"><div className="border-b px-4 py-3 dark:border-gray-700"><h2 className="font-bold text-gray-900 dark:text-white">Accounting totals</h2></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Metric</th><th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Amounts</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{Object.entries(report.totals || {}).map(([key, values]) => <tr key={key}><td className="px-4 py-3 font-semibold capitalize text-gray-900 dark:text-white">{key.replace(/_/g, ' ')}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200"><CurrencyAmounts values={values} /></td></tr>)}</tbody></table></div></section><section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"><div className="border-b px-4 py-3 dark:border-gray-700"><h2 className="font-bold text-gray-900 dark:text-white">Status totals</h2></div><div className="grid gap-3 p-4 md:grid-cols-3">{Object.entries(report.status_totals || {}).map(([key, values]) => <div key={key} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><p className="mb-2 font-semibold capitalize text-gray-900 dark:text-white">{key.replace(/_/g, ' ')}</p><CurrencyAmounts values={values} /></div>)}</div></section></div>}
        </div>
      )}
    </div>
  );
};

export default FinanceControls;
