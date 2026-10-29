import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const home = readFileSync('src/pages/Home.jsx', 'utf8');
const functions = home.slice(home.indexOf('const REPORT_TIME_ZONE'), home.indexOf('const moneyValue'));
const context = vm.createContext({ Intl, Date });
vm.runInContext(`${functions}\nglobalThis.anchors = buildMonthAnchors; globalThis.apiDate = toApiDate; globalThis.parts = datePartsInReportZone;`, context);
const dates = (year, month) => Array.from(context.anchors(7, { year, month, day: 15 }), x => context.apiDate(x));
assert.deepEqual(dates(2026, 10), ['2026-04-01','2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01']);
assert.deepEqual(dates(2027, 1), ['2026-07-01','2026-08-01','2026-09-01','2026-10-01','2026-11-01','2026-12-01','2027-01-01']);
assert.equal(context.apiDate(context.parts(new Date('2026-10-27T21:30:00Z'))), '2026-10-28');
assert.equal(dates(2024, 2).at(-1), '2024-02-01');
const { apiErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(readFileSync('src/utils/apiError.js')).toString('base64')}`);
assert.equal(apiErrorMessage({ response: { data: { product_profit_percentage: { message: 'Too high', code: 'INVALID' } } } }, 'Fallback'), 'product_profit_percentage: Too high');
assert.equal(apiErrorMessage({ response: { data: { detail: 'Forbidden' } } }, 'Fallback'), 'detail: Forbidden');
console.log('PASS: Home current-month window, year rollover, Damascus midnight, leap-year month, structured API errors (6 checks).');

assert.equal(apiErrorMessage({ response: { data: { success: false, error: { code: 'VALIDATION_ERROR', message: { en: 'Validation failed', ar: 'خطأ' }, fields: { external_product: ['Disabled item'] } }, meta: { request_id: 'hidden' } } } }, 'Fallback'), 'external_product: Disabled item');
console.log('PASS: structured validation envelope exposes field errors and omits request metadata.');
