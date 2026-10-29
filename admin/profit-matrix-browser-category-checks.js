(async () => {
  const { sleep, wait, matrix, click, input, ready, rows, cell, dirty, assert, results } = window.__pm;
  const start = results.length;
  const headers = { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' };
  const api = async (path, options = {}) => {
    const response = await fetch(`http://127.0.0.1:8018/api/${path}`, { headers, ...options });
    return { status: response.status, data: await response.json() };
  };
  const categoryPatch = (id, data) => api(`users/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  const refresh = async () => { click('Refresh categories and data'); await ready(); };
  try {
    let categories = (await api('users/categories/active_categories/')).data;
    const vip = categories.find((item) => item.name === 'vip');
    const vipColumn = categories.findIndex((item) => item.id === vip.id);
    input(cell(0, vipColumn), '9.75'); await sleep(80);
    assert((await categoryPatch(vip.id, { is_active: false })).status === 200, 'Category can be deactivated in existing admin API');
    click('Save changes');
    await wait(() => matrix().querySelector('[role=alert]') && !matrix().querySelector('fieldset').disabled, 'inactive category save rejection');
    assert(cell(0, vipColumn).value === '9.75' && dirty().includes('1 unsaved') && !matrix().querySelector('[role=status]'), 'Backend validation error is displayed and unsaved value retained without success notice');
    click('Cancel all edits');
    await categoryPatch(vip.id, { is_active: true });
    await refresh();
    const added = await api('users/categories/', { method: 'POST', body: JSON.stringify({ name: 'matrix-new', display_name: 'New Matrix Category', profit_percentage: '2.75', is_active: true }) });
    assert(added.status === 201, 'New category is created through existing category API');
    const id = added.data.id;
    await refresh();
    await wait(() => rows()[0].querySelectorAll('input[type=number]').length === 4, 'new category column');
    assert(matrix().textContent.includes('New Matrix Category'), 'New active category appears automatically on refresh');
    categories = (await api('users/categories/active_categories/')).data;
    const column = categories.findIndex((item) => item.id === id);
    input(cell(0, column), '4.50'); await sleep(80); click('Save', rows()[0]);
    await wait(() => dirty().includes('All changes saved') && !matrix().querySelector('fieldset').disabled, 'new category rate saved');
    await categoryPatch(id, { display_name: 'Renamed Matrix Category' });
    await refresh();
    await wait(() => matrix().textContent.includes('Renamed Matrix Category'), 'renamed header');
    assert(cell(0, column).value === '4.50', 'Renaming a category updates the header and retains its saved rate');
    await categoryPatch(id, { is_active: false }); await refresh();
    await wait(() => rows()[0].querySelectorAll('input[type=number]').length === 3, 'inactive category hidden');
    assert(!matrix().textContent.includes('Renamed Matrix Category'), 'Inactive category is removed from editable columns');
    await categoryPatch(id, { is_active: true }); await refresh();
    await wait(() => rows()[0].querySelectorAll('input[type=number]').length === 4, 'reactivated category');
    assert(cell(0, column).value === '4.50', 'Reactivation restores the stored rate without loss');
    categories = (await api('users/categories/active_categories/')).data;
    for (const category of categories) await categoryPatch(category.id, { is_active: false });
    await refresh();
    await wait(() => matrix().textContent.includes('No active customer categories'), 'empty categories');
    assert(rows().length === 0 && matrix().textContent.includes('No default rates are created'), 'No-category state is explicit and creates no default categories');
    for (const category of categories) await categoryPatch(category.id, { is_active: true });
    await refresh();
    await wait(() => rows().length === 25, 'restored fixture categories');
    const openOriginal = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      const target = window.__pmFailCategories && String(url).includes('/users/categories/active_categories/') ? `${url}missing/` : url;
      return openOriginal.call(this, method, target, ...rest);
    };
    window.__pmFailCategories = true;
    await refresh();
    await wait(() => matrix().querySelector('[role=alert]'), 'category read failure');
    assert(cell().disabled && !matrix().textContent.includes('No active customer categories'), 'Category API failure prevents editing and is not shown as an empty category list');
    window.__pmFailCategories = false;
    await refresh();
    await wait(() => !cell().disabled && !matrix().querySelector('[role=alert]'), 'load recovery');
    assert(cell(0, column).value === '4.50', 'Refreshing after API recovery restores editing and saved values');
    window.__profitMatrixCategoryResults = results.slice(start);
    return { passed: results.length - start, results: results.slice(start) };
  } catch (error) {
    return { passed: results.length - start, results: results.slice(start), failure: error.message, stack: error.stack };
  } finally { window.__pmFailCategories = false; }
})()
