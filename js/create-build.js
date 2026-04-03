/* ============================================================
   ARAM BOUND — create-build.js
   Loads Data Dragon items, renders icon paths with hover names,
   and manages main + alternate build paths.
   ============================================================ */

'use strict';

const DDRAGON_VERSION = '14.8.1';
const ITEM_DATA_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`;

const MAX_ITEMS_PER_PATH = 6;

/** @type {Record<string, { name: string, icon: string }>} */
let itemCatalog = {};
/** @type {{ name: string, id: string }[]} */
let itemSearchList = [];

/**
 * @param {string} itemId
 * @returns {string}
 */
function itemIconUrl(itemId) {
  const meta = itemCatalog[itemId];
  if (meta && meta.icon) return meta.icon;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

/**
 * @param {object} raw
 * @returns {boolean}
 */
function includeItemInCatalog(raw) {
  if (!raw || !raw.gold || !raw.gold.purchasable) return false;
  if (raw.hideFromAll) return false;
  if (raw.requiredChampion) return false;
  if (raw.requiredAlly) return false;
  const total = raw.gold.total;
  if (typeof total !== 'number' || total <= 0) return false;
  const name = raw.name || '';
  if (/^Enchantment:/i.test(name)) return false;
  return true;
}

async function loadItemCatalog() {
  const res = await fetch(ITEM_DATA_URL);
  if (!res.ok) throw new Error('Could not load item data');
  const json = await res.json();
  const data = json.data || {};
  itemCatalog = {};
  itemSearchList = [];

  Object.keys(data).forEach((id) => {
    const raw = data[id];
    if (!includeItemInCatalog(raw)) return;
    const imgFile = raw.image && raw.image.full ? raw.image.full : `${id}.png`;
    const icon = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${imgFile}`;
    const name = String(raw.name).replace(/<[^>]+>/g, '').trim();
    itemCatalog[id] = { name, icon };
    itemSearchList.push({ id, name });
  });

  itemSearchList.sort((a, b) => a.name.localeCompare(b.name));
}

const pathsState = {
  main: { items: [] },
  /** @type {{ uid: string, items: string[] }[]} */
  alternates: [],
};

let altUid = 0;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * @param {string} query
 * @returns {{ id: string, name: string }[]}
 */
function filterItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return itemSearchList.slice(0, 40);
  const out = [];
  for (let i = 0; i < itemSearchList.length && out.length < 50; i++) {
    const row = itemSearchList[i];
    if (row.name.toLowerCase().includes(q)) out.push(row);
  }
  return out;
}

// ============================================================
//  AUGMENT POOL (from mayhem-augment-pool.json)
// ============================================================

/** @type {{ silver: string[], gold: string[], prismatic: string[] } | null} */
let augmentPoolByTier = null;

const AUGMENT_POOL_URL = 'js/mayhem-augment-pool.json';

async function loadAugmentPool() {
  const res = await fetch(AUGMENT_POOL_URL);
  if (!res.ok) throw new Error('augment pool');
  /** @type {{ name: string, tier: string }[]} */
  const rows = await res.json();
  augmentPoolByTier = { silver: [], gold: [], prismatic: [] };
  rows.forEach((r) => {
    const t = r.tier;
    if (t === 'silver') augmentPoolByTier.silver.push(r.name);
    else if (t === 'gold') augmentPoolByTier.gold.push(r.name);
    else if (t === 'prismatic') augmentPoolByTier.prismatic.push(r.name);
  });
  // Keep options sorted for selects
  augmentPoolByTier.silver.sort((a, b) => a.localeCompare(b));
  augmentPoolByTier.gold.sort((a, b) => a.localeCompare(b));
  augmentPoolByTier.prismatic.sort((a, b) => a.localeCompare(b));
}

/**
 * Builds simple initials for a text label (icon substitute).
 * @param {string} name
 */
function initialsForAugment(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? parts[1][0] || '' : '';
  return (first + second).toUpperCase();
}

/**
 * @param {HTMLSelectElement} select
 */
function applyAugmentSelection(select) {
  const card = select.closest('.create-augment-card');
  if (!card) return;
  const nameEl = card.querySelector('[data-role="name"]');
  const iconEl = card.querySelector('[data-role="icon"]');
  const value = select.value;
  if (!nameEl) return;
  if (!value) {
    nameEl.textContent = select.getAttribute('data-placeholder') || 'Choose an augment…';
    if (iconEl) iconEl.textContent = '';
    return;
  }
  nameEl.textContent = value;
  if (iconEl) iconEl.textContent = initialsForAugment(value);
}

function initAugmentSection() {
  const gridRoot = document.getElementById('create-augments');
  const err = document.getElementById('create-augments-error');
  if (!gridRoot) return;

  loadAugmentPool()
    .then(() => {
      /** @type {NodeListOf<HTMLElement>} */
      const groups = gridRoot.querySelectorAll('.create-augment-group');
      groups.forEach((group) => {
        const tier = group.getAttribute('data-tier');
        /** @type {'silver'|'gold'|'prismatic'} */
        const t = tier === 'gold' || tier === 'prismatic' ? tier : 'silver';
        const pool = augmentPoolByTier && augmentPoolByTier[t] ? augmentPoolByTier[t] : [];
        /** @type {NodeListOf<HTMLSelectElement>} */
        const selects = group.querySelectorAll('.create-augment-select');
        selects.forEach((sel) => {
          // Cache placeholder for reset
          if (!sel.getAttribute('data-placeholder')) {
            const card = sel.closest('.create-augment-card');
            const nameEl = card && card.querySelector('[data-role="name"]');
            if (nameEl) sel.setAttribute('data-placeholder', nameEl.textContent || '');
          }
          // Populate options
          pool.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
          });
          sel.addEventListener('change', () => applyAugmentSelection(sel));
        });
      });
    })
    .catch(() => {
      if (err) {
        err.hidden = false;
        err.textContent = 'Could not load augment list (mayhem-augment-pool.json). Check your connection and refresh.';
      }
    });
}

/**
 * @param {string[]} items
 * @param {string} pathKey
 */
function renderItemRow(items, pathKey) {
  const parts = [];
  items.forEach((id, idx) => {
    const meta = itemCatalog[id];
    const name = meta ? meta.name : `Item ${id}`;
    const icon = itemIconUrl(id);
    if (idx > 0) {
      parts.push('<span class="create-item-arrow" aria-hidden="true">→</span>');
    }
    parts.push(`
      <div class="create-item-slot" data-path="${escapeHtml(pathKey)}" data-idx="${idx}">
        <div class="create-item-icon-wrap" tabindex="0" aria-label="${escapeHtml(name)}">
          <img src="${escapeHtml(icon)}" alt="" width="48" height="48" loading="lazy" />
          <span class="create-item-name-tip">${escapeHtml(name)}</span>
        </div>
        <button type="button" class="create-item-remove" data-path="${escapeHtml(pathKey)}" data-idx="${idx}" aria-label="Remove ${escapeHtml(name)}">×</button>
      </div>
    `);
  });

  if (items.length < MAX_ITEMS_PER_PATH) {
    if (items.length > 0) {
      parts.push('<span class="create-item-arrow create-item-arrow--dim" aria-hidden="true">→</span>');
    }
    parts.push(`
      <div class="create-item-slot create-item-slot--empty" aria-hidden="true">
        <span class="create-item-placeholder">+</span>
      </div>
    `);
  }

  return `<div class="create-item-row" role="group" aria-label="Item build order">${parts.join('')}</div>`;
}

/**
 * @param {string} pathKey
 */
function bindRowButtons(pathKey, container) {
  container.querySelectorAll('.create-item-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const pk = btn.getAttribute('data-path');
      removeItemAt(pk, idx);
    });
  });
}

/**
 * @param {string} pathKey
 * @param {number} idx
 */
function removeItemAt(pathKey, idx) {
  if (pathKey === 'main') {
    pathsState.main.items.splice(idx, 1);
  } else {
    const block = pathsState.alternates.find((a) => a.uid === pathKey);
    if (block) block.items.splice(idx, 1);
  }
  refreshPathDom(pathKey);
}

/**
 * @param {string} pathKey
 * @param {string} itemId
 */
function addItemToPath(pathKey, itemId) {
  let list;
  if (pathKey === 'main') list = pathsState.main.items;
  else {
    const block = pathsState.alternates.find((a) => a.uid === pathKey);
    if (!block) return;
    list = block.items;
  }
  if (list.length >= MAX_ITEMS_PER_PATH) return;
  if (list.includes(itemId)) return;
  list.push(itemId);
  refreshPathDom(pathKey);
}

/**
 * @param {string} pathKey
 */
function refreshPathDom(pathKey) {
  const host = document.querySelector(`.create-path-block[data-path-key="${CSS.escape(pathKey)}"]`);
  if (!host) return;
  const rowEl = host.querySelector('.create-item-row-host');
  if (!rowEl) return;

  const list = pathKey === 'main'
    ? pathsState.main.items
    : (pathsState.alternates.find((a) => a.uid === pathKey) || { items: [] }).items;

  rowEl.innerHTML = renderItemRow(list, pathKey);
  bindRowButtons(pathKey, rowEl);
}

function wireSearch(pathKey) {
  const host = document.querySelector(`.create-path-block[data-path-key="${CSS.escape(pathKey)}"]`);
  if (!host) return;

  const input = host.querySelector('.create-item-search-input');
  const listEl = host.querySelector('.create-item-search-results');
  if (!input || !listEl) return;

  function renderResults() {
    const rows = filterItems(input.value);
    listEl.innerHTML = rows
      .map((r) => {
        const icon = itemIconUrl(r.id);
        return `
          <button type="button" class="create-search-hit" data-id="${escapeHtml(r.id)}">
            <img src="${escapeHtml(icon)}" alt="" width="32" height="32" loading="lazy" />
            <span>${escapeHtml(r.name)}</span>
          </button>
        `;
      })
      .join('');
    listEl.hidden = rows.length === 0;
  }

  input.addEventListener('input', () => renderResults());
  input.addEventListener('focus', () => renderResults());

  listEl.addEventListener('click', (e) => {
    const hit = e.target.closest('.create-search-hit');
    if (!hit) return;
    const id = hit.getAttribute('data-id');
    if (id) {
      addItemToPath(pathKey, id);
      input.value = '';
      listEl.innerHTML = '';
      listEl.hidden = true;
    }
  });
}

function initCreateSearchCloseOnOutsideClick() {
  if (initCreateSearchCloseOnOutsideClick.done) return;
  initCreateSearchCloseOnOutsideClick.done = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.create-item-search-results').forEach((listEl) => {
      if (listEl.hidden) return;
      const host = listEl.closest('.create-path-block');
      if (host && !host.contains(e.target)) listEl.hidden = true;
    });
  });
}

function renderAlternateBlocks() {
  const wrap = document.getElementById('create-alt-paths');
  if (!wrap) return;

  wrap.innerHTML = pathsState.alternates
    .map((block) => {
      const pk = block.uid;
      const list = block.items;
      return `
        <div class="create-path-block create-path-block--alt" data-path-key="${escapeHtml(pk)}">
          <div class="create-path-alt-head">
            <span class="bd-subsection-title">Alternate path</span>
            <button type="button" class="btn btn-ghost btn-sm create-alt-remove" data-uid="${escapeHtml(pk)}">Remove</button>
          </div>
          <label class="create-field">
            <span class="create-field-label">Short label</span>
            <input type="text" class="create-input" placeholder="e.g. vs heavy tanks, pure ranged comp" maxlength="120" />
          </label>
          <label class="create-field">
            <span class="create-field-label">When to use this path</span>
            <textarea class="create-textarea" rows="3" placeholder="Explain the enemy team patterns or game states where this item order shines instead of your core path."></textarea>
          </label>
          <label class="create-field">
            <span class="create-field-label">Situational notes (optional)</span>
            <input type="text" class="create-input" placeholder="e.g. swap Void Staff earlier against double-tank frontlines" />
          </label>
          <div class="bd-subsection-title" style="margin-top:8px;">Items</div>
          <div class="create-item-row-host">${renderItemRow(list, pk)}</div>
          <div class="create-item-search">
            <input type="search" class="create-item-search-input" placeholder="Search items by name…" autocomplete="off" aria-label="Search items to add" />
            <div class="create-item-search-results" hidden></div>
          </div>
        </div>
      `;
    })
    .join('');

  pathsState.alternates.forEach((block) => {
    const host = wrap.querySelector(`.create-path-block[data-path-key="${CSS.escape(block.uid)}"]`);
    if (host) {
      const rowEl = host.querySelector('.create-item-row-host');
      if (rowEl) bindRowButtons(block.uid, rowEl);
      wireSearch(block.uid);
    }
  });

  wrap.querySelectorAll('.create-alt-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-uid');
      pathsState.alternates = pathsState.alternates.filter((a) => a.uid !== uid);
      renderAlternateBlocks();
    });
  });
}

function initCreateBuildPage() {
  const mainHost = document.querySelector('.create-path-block[data-path-key="main"]');
  if (!mainHost) return;

  initCreateSearchCloseOnOutsideClick();
  initAugmentSection();

  loadItemCatalog()
    .then(() => {
      const rowEl = mainHost.querySelector('.create-item-row-host');
      if (rowEl) {
        rowEl.innerHTML = renderItemRow(pathsState.main.items, 'main');
        bindRowButtons('main', rowEl);
      }
      wireSearch('main');
      const addAltBtn = document.getElementById('addAltPath');
      if (addAltBtn) addAltBtn.disabled = false;
    })
    .catch(() => {
      const err = document.getElementById('create-items-error');
      if (err) {
        err.hidden = false;
        err.textContent = 'Could not load item icons. Check your connection and refresh.';
      }
    });

  const addAltBtn = document.getElementById('addAltPath');
  if (addAltBtn) {
    addAltBtn.addEventListener('click', () => {
      const uid = `alt-${++altUid}`;
      pathsState.alternates.push({ uid, items: [] });
      renderAlternateBlocks();
    });
  }
}

document.addEventListener('DOMContentLoaded', initCreateBuildPage);
