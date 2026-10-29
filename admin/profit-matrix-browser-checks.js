(async () => {
  const results = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (check, label) => {
    const until = Date.now() + 7000;
    while (Date.now() < until) { if (check()) return; await sleep(40); }
    throw new Error(`Timeout: ${label}`);
  };
  const assert = (value, label) => { if (!value) throw new Error(label); results.push(label); };
  const matrix = () => document.querySelector('section[aria-label="Manage profit rates"]');
  const button = (label, root = matrix()) => Array.from(root.querySelectorAll('button')).find((node) => node.textContent.trim() === label);
  const click = (label, root) => { const node = button(label, root); if (!node || node.disabled) throw new Error(`Missing/enabled button: ${label}`); node.click(); };
  const input = (node, value) => {
    const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  };
  const ready = async () => { await sleep(120); await wait(() => matrix() && matrix().querySelector('[aria-busy]')?.getAttribute('aria-busy') !== 'true', 'matrix loaded'); };
  const rows = () => Array.from(matrix().querySelectorAll('tbody tr')).filter((row) => row.querySelector('input[type=number]'));
  const cell = (index = 0, column = 0) => rows()[index].querySelectorAll('input[type=number]')[column];
  const changeFilter = async (name, value) => {
    const label = Array.from(matrix().querySelectorAll('label')).find((node) => node.textContent.trim().startsWith(name));
    const node = label.querySelector('input,select');
    if (node.value === value) return;
    const before = reads.length;
    input(node, value);
    const key = { 'Search by name or ID':'search', 'Section':'section_id', 'Provider':'api_id', 'Currency':'currency', 'Product status':'is_active' }[name];
    await wait(() => reads.slice(before).some((item) => item.done && item.status === 200 && (new URL(item.url, location.origin).searchParams.get(key) || '') === value), 'filtered backend response '+name);
    await ready();
  };
  const dirty = () => matrix().querySelector('[aria-live=polite]').textContent;
  const reads = [];
  const openOriginal = XMLHttpRequest.prototype.open;
  const sendOriginal = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) { this.__pmMethod = method; this.__pmUrl = url; return openOriginal.call(this, method, url, ...rest); };
  XMLHttpRequest.prototype.send = function(...args) {
    if (this.__pmMethod?.toUpperCase() === 'GET' && this.__pmUrl?.includes('/profit-matrix/')) {
      const item = { url: this.__pmUrl, done: false }; reads.push(item);
      this.addEventListener('loadend', () => { item.done = true; item.status = this.status; });
    }
    return sendOriginal.apply(this, args);
  };
  const confirmOriginal = window.confirm;
  window.__pm = { sleep, wait, assert, matrix, button, click, input, ready, rows, cell, changeFilter, dirty, results, confirmOriginal };
  try {
    if (matrix()) { window.confirm = () => true; click('Back to product list'); await sleep(80); window.confirm = confirmOriginal; }
    click('Manage profit rates', document);
    await ready();
    assert(rows().length === 25, 'Initial backend page has 25 rows');
    const activeCategories = await (await fetch('http://127.0.0.1:8018/api/users/categories/active_categories/', {headers:{Authorization:'Bearer '+localStorage.getItem('access_token')}})).json();
    assert(cell().closest('tr').querySelectorAll('input[type=number]').length === activeCategories.length, 'All active categories are dynamic columns');
    const baseline = cell().value;
    assert(matrix().textContent.includes('not applied to selling prices'), 'Administrative-only pricing warning visible');
    input(cell(), '1.25'); await sleep(80);
    assert(dirty().includes('1 unsaved'), 'A single edited cell is tracked');
    let prompts = 0;
    window.confirm = () => { prompts += 1; return false; };
    click('Back to product list'); await sleep(80);
    assert(matrix() && cell().value === '1.25' && prompts === 1, 'Rejecting close preserves the draft');
    click('Add product', document); await sleep(80);
    assert(location.pathname === '/products' && cell().value === '1.25' && prompts === 2, 'Programmatic Add navigation is blocked without draft loss');
    const profileButton = Array.from(document.querySelectorAll('button')).find((node) => node.textContent.trim() === 'PR');
    profileButton.click(); await sleep(120);
    const profileText = Array.from(document.querySelectorAll('p')).find((node) => node.textContent.trim() === 'My Profile');
    if (!profileText) throw new Error('Profile menu item not found');
    profileText.closest('div.cursor-pointer').click(); await sleep(120);
    assert(location.pathname === '/products' && matrix() && cell().value === '1.25' && prompts === 3, 'Profile-menu programmatic navigation is blocked without draft loss');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    assert(beforeUnload.defaultPrevented, 'Before-unload guard protects dirty edits');
    window.confirm = confirmOriginal;
    matrix().querySelector('button[aria-label="Next page"]').click(); await ready();
    await wait(() => rows()[0]?.textContent.includes('026'), 'second page');
    input(cell(), '2.50'); await sleep(80);
    assert(dirty().includes('2 unsaved'), 'Off-page drafts remain tracked');
    matrix().querySelector('button[aria-label="Previous page"]').click(); await ready();
    await wait(() => rows()[0]?.textContent.includes('001'), 'first page');
    assert(cell().value === '1.25', 'Returning to the first page preserves its draft');
    await changeFilter('Search by name or ID', '32');
    assert(rows().length === 1 && rows()[0].textContent.includes('032'), 'Search by backend product ID finds the correct row');
    await changeFilter('Currency', 'SYP');
    await changeFilter('Section', '1');
    await changeFilter('Provider', '1');
    assert(rows().length === 1 && rows()[0].textContent.includes('032'), 'Currency/section/provider filters combine on the backend');
    await changeFilter('Product status', 'false');
    assert(rows().length === 0, 'Inactive filter correctly excludes an active result');
    await changeFilter('Product status', 'true');
    assert(rows().length === 1 && dirty().includes('2 unsaved'), 'Filtering preserves all hidden drafts');
    for (const name of ['Search by name or ID', 'Currency', 'Section', 'Provider', 'Product status']) await changeFilter(name, '');
    assert(cell().value === '1.25', 'Clearing filters restores the original unsaved cell');
    click('Cancel', rows()[0]); await sleep(80);
    assert(dirty().includes('1 unsaved') && cell().value === baseline, 'Row cancel only discards that row');
    click('Cancel all edits'); await sleep(80);
    assert(dirty().includes('All changes saved'), 'Global cancel clears remaining drafts');
    window.__profitMatrixChecks = results;
    return { passed: results.length, results };
  } catch (error) {
    return { passed: results.length, results, failure: error.message, stack: error.stack };
  } finally { window.confirm = confirmOriginal; }
})()
