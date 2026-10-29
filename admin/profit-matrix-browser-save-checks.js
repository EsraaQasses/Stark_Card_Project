(async () => {
  const { sleep, wait, matrix, click, input, ready, rows, cell, dirty, assert, results } = window.__pm;
  const start = results.length;
  const headers = { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' };
  const api = async (path, options = {}) => {
    const response = await fetch(`http://127.0.0.1:8018/api/${path}`, { headers, ...options });
    return { status: response.status, data: await response.json() };
  };
  const writes = [];
  const sendOriginal = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    if (this.__pmMethod?.toUpperCase() === 'PATCH' && this.__pmUrl?.includes('/profit-matrix/')) {
      const item = { body: JSON.parse(body), done: false }; writes.push(item);
      this.addEventListener('loadend', () => { item.done = true; item.status = this.status; });
    }
    return sendOriginal.call(this, body);
  };
  try {
    input(cell(), '0.25'); await sleep(80);
    click('Save', rows()[0]);
    await wait(() => writes[0]?.done && writes[0].status === 200 && dirty().includes('All changes saved'), 'single save');
    await ready();
    assert(writes[0].body.changes.length === 1, 'Single-row save sends only its one dirty cell');
    let current = await api('store/admin/profit-matrix/?page_size=100');
    const categoryId = current.data.categories[0].id;
    let rate = current.data.results.find((row) => row.id === 1).rates.find((row) => row.category_id === categoryId);
    assert(rate.profit_percentage === '0.25' && rate.revision === 1, 'Single save persists decimal and revision 1');
    input(cell(0, 1), '0.50'); await sleep(80);
    matrix().querySelector('button[aria-label="Next page"]').click(); await ready();
    await wait(() => rows()[0]?.textContent.includes('026'), 'second page before bulk');
    input(cell(0, 2), '0'); await sleep(80);
    click('Save changes');
    await wait(() => writes[1]?.done && writes[1].status === 200 && dirty().includes('All changes saved'), 'bulk save');
    await ready();
    assert(writes[1].body.changes.length === 2 && writes[1].body.changes.some((row) => row.product_id === 1) && writes[1].body.changes.some((row) => row.product_id === 26), 'Bulk save atomically includes only two dirty cells across pages');
    current = await api('store/admin/profit-matrix/?page_size=100');
    assert(current.data.results.find((row) => row.id === 26).rates.some((row) => row.profit_percentage === '0.00'), 'Zero is stored as an explicit rate for the SYP product');
    click('Back to product list'); await sleep(80);
    click('Manage profit rates', document); await ready();
    assert(cell().value === '0.25', 'Closing and reopening reloads saved values');
    input(cell(), '-1'); await sleep(80);
    click('Save changes'); await sleep(80);
    assert(writes.length === 2 && matrix().querySelector('[role=alert]') && dirty().includes('1 unsaved'), 'Invalid rate is blocked without losing the draft or calling PATCH');
    click('Cancel all edits'); await sleep(80);
    input(cell(), '2.25'); await sleep(80);
    const competing = await api('store/admin/profit-matrix/', { method: 'PATCH', body: JSON.stringify({ changes: [{ product_id: 1, category_id: categoryId, profit_percentage: '3.25', expected_revision: 1 }] }) });
    assert(competing.status === 200, 'Competing update advances the server revision');
    click('Save changes');
    await wait(() => writes[2]?.done && writes[2].status === 409, 'stale save conflict');
    await sleep(80);
    assert(dirty().includes('1 unsaved') && cell().value === '2.25' && window.__pm.button('Save changes').disabled, '409 keeps the unsaved value and blocks blind retries');
    const confirmOriginal = window.confirm;
    window.confirm = () => false;
    click('Reload and discard local edits'); await sleep(80);
    assert(cell().value === '2.25', 'Refusing conflict recovery preserves local edits');
    window.confirm = () => true;
    click('Reload and discard local edits'); await ready();
    window.confirm = confirmOriginal;
    assert(dirty().includes('All changes saved') && cell().value === '3.25', 'Confirmed reload resolves the conflict using current backend data');
    window.__profitMatrixSaveResults = results.slice(start);
    return { passed: results.length - start, results: results.slice(start) };
  } catch (error) {
    return { passed: results.length - start, results: results.slice(start), failure: error.message, stack: error.stack };
  }
})()
