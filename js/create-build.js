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
  const seenNames = new Set();
  itemSearchList = itemSearchList.filter((row) => {
    const key = row.name.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
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

/** @type {{ silver: { name: string, tier: string, icon: string }[], gold: { name: string, tier: string, icon: string }[], prismatic: { name: string, tier: string, icon: string }[] } | null} */
let augmentPoolByTier = null;

const AUGMENT_POOL_URL = 'js/mayhem-augment-pool.json';

async function loadAugmentPool() {
  const res = await fetch(AUGMENT_POOL_URL);
  if (!res.ok) throw new Error('augment pool');
  /** @type {{ name: string, tier: string, icon: string }[]} */
  const rows = await res.json();
  augmentPoolByTier = { silver: [], gold: [], prismatic: [] };
  rows.forEach((r) => {
    const t = r.tier;
    if (t === 'silver') augmentPoolByTier.silver.push(r);
    else if (t === 'gold') augmentPoolByTier.gold.push(r);
    else if (t === 'prismatic') augmentPoolByTier.prismatic.push(r);
  });
  augmentPoolByTier.silver.sort((a, b) => a.name.localeCompare(b.name));
  augmentPoolByTier.gold.sort((a, b) => a.name.localeCompare(b.name));
  augmentPoolByTier.prismatic.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Icon URL for the selected augment. Prefer JSON pool lookup — some browsers
 * do not preserve `data-*` on `<option>`; lazy+hidden preview imgs can also
 * block loading until we set eager and unhide after load.
 * @param {HTMLSelectElement} select
 * @param {string} augmentName
 * @returns {string}
 */
function resolveAugmentIconUrl(select, augmentName) {
  const group = select.closest('.create-augment-group');
  const tier = group && group.getAttribute('data-tier');
  const t = tier === 'gold' || tier === 'prismatic' ? tier : 'silver';
  const pool = augmentPoolByTier && augmentPoolByTier[t];
  if (pool && augmentName) {
    const row = pool.find((r) => r.name === augmentName);
    if (row && row.icon) return row.icon;
  }
  const opt = select.selectedOptions[0];
  return (opt && opt.getAttribute('data-icon')) || '';
}

/**
 * @param {HTMLSelectElement} select
 */
function applyAugmentSelection(select) {
  const card = select.closest('.create-augment-card');
  if (!card) return;
  const nameEl = card.querySelector('[data-role="name"]');
  const iconImg = card.querySelector('[data-role="icon-img"]');
  const iconFb = card.querySelector('[data-role="icon-fallback"]');
  const value = select.value;
  if (!nameEl || !iconImg || !iconFb) return;

  if (!value) {
    nameEl.textContent = select.getAttribute('data-placeholder') || 'Choose an augment…';
    iconImg.removeAttribute('src');
    iconImg.alt = '';
    iconImg.hidden = true;
    iconFb.hidden = false;
    return;
  }

  nameEl.textContent = value;
  const iconUrl = resolveAugmentIconUrl(select, value);
  if (!iconUrl) {
    iconImg.hidden = true;
    iconFb.hidden = false;
    return;
  }

  iconImg.alt = value;
  iconImg.onerror = () => {
    iconImg.removeAttribute('src');
    iconImg.alt = '';
    iconImg.hidden = true;
    iconFb.hidden = false;
    iconImg.onerror = null;
  };
  iconImg.onload = () => {
    iconImg.hidden = false;
    iconFb.hidden = true;
  };
  iconImg.loading = 'eager';
  iconImg.src = iconUrl;
  if (iconImg.complete && iconImg.naturalWidth > 0) {
    iconImg.hidden = false;
    iconFb.hidden = true;
  }
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
          if (!sel.getAttribute('data-placeholder')) {
            const card = sel.closest('.create-augment-card');
            const nameEl = card && card.querySelector('[data-role="name"]');
            if (nameEl) sel.setAttribute('data-placeholder', nameEl.textContent || '');
          }
          pool.forEach((row) => {
            const opt = document.createElement('option');
            opt.value = row.name;
            opt.textContent = row.name;
            if (row.icon) opt.setAttribute('data-icon', row.icon);
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
      const pathHost = listEl.closest('.create-path-block');
      const champHost = listEl.closest('.create-champ-search-host');
      const host = pathHost || champHost;
      if (host && !host.contains(e.target)) listEl.hidden = true;
    });
  });
}

/** @type {{ id: string, name: string, icon: string }[]} */
const CREATE_FORM_CHAMPIONS = [
  {
    id: 'ahri',
    name: 'Ahri',
    icon: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/Ahri.png`,
  },
  {
    id: 'lux',
    name: 'Lux',
    icon: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/Lux.png`,
  },
];

/** Same art as the client; wiki Special:FilePath URLs often 404 for spell PNGs. */
const DDRAGON_SPELL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell`;
const CREATE_SUMMONER_ICON = {
  snowball: `${DDRAGON_SPELL}/SummonerSnowball.png`,
  clarity: `${DDRAGON_SPELL}/SummonerMana.png`,
  ignite: `${DDRAGON_SPELL}/SummonerDot.png`,
  flash: `${DDRAGON_SPELL}/SummonerFlash.png`,
  ghost: `${DDRAGON_SPELL}/SummonerHaste.png`,
  heal: `${DDRAGON_SPELL}/SummonerHeal.png`,
  cleanse: `${DDRAGON_SPELL}/SummonerBoost.png`,
};

const YOUTUBE_NOCOOKIE_EMBED = 'https://www.youtube-nocookie.com/embed/';
const YT_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

/**
 * Strict allowlist: only youtu.be / youtube.com / m.youtube.com / youtube-nocookie.com.
 * @param {string} raw
 * @returns {string | null} 11-character video id
 */
function parseYoutubeVideoIdFromUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let urlString = trimmed;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const seg = url.pathname.split('/').filter(Boolean)[0];
    return seg && YT_VIDEO_ID_RE.test(seg) ? seg : null;
  }

  if (url.pathname === '/watch' || url.pathname === '/watch/') {
    const v = url.searchParams.get('v');
    return v && YT_VIDEO_ID_RE.test(v) ? v : null;
  }

  if (url.pathname.startsWith('/embed/')) {
    const seg = url.pathname.slice('/embed/'.length).split('/')[0];
    return seg && YT_VIDEO_ID_RE.test(seg) ? seg : null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'shorts' && parts[1]) {
    return YT_VIDEO_ID_RE.test(parts[1]) ? parts[1] : null;
  }
  if (parts[0] === 'live' && parts[1]) {
    return YT_VIDEO_ID_RE.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

/**
 * @param {string} videoId
 * @param {number | null} startSec
 * @param {number | null} endSec
 * @returns {string}
 */
function buildYoutubeNoCookieEmbedSrc(videoId, startSec, endSec) {
  const base = `${YOUTUBE_NOCOOKIE_EMBED}${encodeURIComponent(videoId)}`;
  const p = new URLSearchParams();
  p.set('rel', '0');
  if (startSec != null && startSec >= 0 && Number.isFinite(startSec)) {
    p.set('start', String(Math.floor(startSec)));
  }
  if (endSec != null && endSec > 0 && Number.isFinite(endSec)) {
    p.set('end', String(Math.floor(endSec)));
  }
  return `${base}?${p.toString()}`;
}

/**
 * @param {{
 *   urlIn: HTMLInputElement,
 *   startIn: HTMLInputElement | null,
 *   endIn: HTMLInputElement | null,
 *   hidId: HTMLInputElement,
 *   hidStart: HTMLInputElement,
 *   hidEnd: HTMLInputElement,
 *   err: HTMLElement,
 *   wrap: HTMLElement,
 *   iframe: HTMLIFrameElement,
 *   clearBtn: HTMLButtonElement | null,
 * }} slot
 * @returns {(() => void) | null}
 */
function wireYoutubeHighlightSlot(slot) {
  const { urlIn, startIn, endIn, hidId, hidStart, hidEnd, err, wrap, iframe, clearBtn } = slot;
  if (!urlIn || !hidId || !hidStart || !hidEnd || !iframe || !err || !wrap) return null;

  let debounceTimer = 0;

  function showError(msg) {
    err.textContent = msg;
    err.hidden = !msg;
  }

  /**
   * @param {HTMLInputElement | null} el
   * @returns {null | number | NaN}
   */
  function parseOptionalSec(el) {
    if (!el) return null;
    const v = el.value.trim();
    if (v === '') return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return n;
  }

  function sync() {
    const raw = urlIn.value.trim();
    showError('');

    if (!raw) {
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    const vid = parseYoutubeVideoIdFromUrl(raw);
    if (!vid) {
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      showError(
        'Only YouTube links from youtube.com, m.youtube.com, youtu.be, or youtube-nocookie.com are accepted (watch, embed, Shorts, or Live).'
      );
      return;
    }

    const startSec = parseOptionalSec(startIn);
    const endSec = parseOptionalSec(endIn);
    if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
      showError('Start and end must be whole seconds ≥ 0, or left blank.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (endSec != null && startSec == null) {
      showError('Set a start time (seconds) when you set an end time.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      showError('End time must be greater than start time.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    hidId.value = vid;
    hidStart.value = startSec != null ? String(startSec) : '';
    hidEnd.value = endSec != null ? String(endSec) : '';

    iframe.src = buildYoutubeNoCookieEmbedSrc(vid, startSec, endSec);
    wrap.hidden = false;
    if (clearBtn) clearBtn.hidden = false;
  }

  function scheduleSync(delayMs) {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(sync, delayMs);
  }

  urlIn.addEventListener('input', () => scheduleSync(400));
  urlIn.addEventListener('blur', sync);
  if (startIn) {
    startIn.addEventListener('input', () => scheduleSync(200));
    startIn.addEventListener('blur', sync);
  }
  if (endIn) {
    endIn.addEventListener('input', () => scheduleSync(200));
    endIn.addEventListener('blur', sync);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      urlIn.value = '';
      if (startIn) startIn.value = '';
      if (endIn) endIn.value = '';
      sync();
    });
  }

  return () => {
    window.clearTimeout(debounceTimer);
    sync();
  };
}

function initYoutubeHighlightSection() {
  /** @type {(() => void)[]} */
  const syncFns = [];

  const slots = [
    {
      urlIn: document.getElementById('youtubeEarlyUrlInput'),
      startIn: document.getElementById('youtubeEarlyStartInput'),
      endIn: document.getElementById('youtubeEarlyEndInput'),
      hidId: document.getElementById('youtubeEarlyVideoId'),
      hidStart: document.getElementById('youtubeEarlyStartSec'),
      hidEnd: document.getElementById('youtubeEarlyEndSec'),
      err: document.getElementById('create-youtube-error-early'),
      wrap: document.getElementById('youtubeEarlyPreviewWrap'),
      iframe: document.getElementById('youtubeEarlyIframe'),
      clearBtn: document.getElementById('youtubeEarlyClear'),
    },
    {
      urlIn: document.getElementById('youtubeMidUrlInput'),
      startIn: document.getElementById('youtubeMidStartInput'),
      endIn: document.getElementById('youtubeMidEndInput'),
      hidId: document.getElementById('youtubeMidVideoId'),
      hidStart: document.getElementById('youtubeMidStartSec'),
      hidEnd: document.getElementById('youtubeMidEndSec'),
      err: document.getElementById('create-youtube-error-mid'),
      wrap: document.getElementById('youtubeMidPreviewWrap'),
      iframe: document.getElementById('youtubeMidIframe'),
      clearBtn: document.getElementById('youtubeMidClear'),
    },
    {
      urlIn: document.getElementById('youtubeLateUrlInput'),
      startIn: document.getElementById('youtubeLateStartInput'),
      endIn: document.getElementById('youtubeLateEndInput'),
      hidId: document.getElementById('youtubeLateVideoId'),
      hidStart: document.getElementById('youtubeLateStartSec'),
      hidEnd: document.getElementById('youtubeLateEndSec'),
      err: document.getElementById('create-youtube-error-late'),
      wrap: document.getElementById('youtubeLatePreviewWrap'),
      iframe: document.getElementById('youtubeLateIframe'),
      clearBtn: document.getElementById('youtubeLateClear'),
    },
  ];

  slots.forEach((s) => {
    const fn = wireYoutubeHighlightSlot(s);
    if (fn) syncFns.push(fn);
  });

  const form = document.getElementById('createBuildForm');
  if (form && syncFns.length) {
    /** @type {{ _youtubeSyncFns?: (() => void)[] }} */
    const f = form;
    f._youtubeSyncFns = syncFns;
    form.addEventListener('submit', () => {
      syncFns.forEach((fn) => fn());
    });
  }
}

/**
 * @param {string} query
 */
function filterCreateFormChampions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return CREATE_FORM_CHAMPIONS.slice();
  return CREATE_FORM_CHAMPIONS.filter((c) => c.name.toLowerCase().includes(q));
}

/**
 * @param {HTMLSelectElement} selectEl
 * @param {HTMLImageElement} imgEl
 */
function updateCreateSummonerPreview(selectEl, imgEl) {
  const key = selectEl.value;
  const url = key ? CREATE_SUMMONER_ICON[/** @type {keyof typeof CREATE_SUMMONER_ICON} */ (key)] : '';
  imgEl.onerror = () => {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.hidden = true;
    imgEl.onerror = null;
  };
  if (!url) {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.hidden = true;
    return;
  }
  imgEl.alt = (selectEl.selectedOptions[0] && selectEl.selectedOptions[0].textContent.trim()) || '';
  imgEl.onload = () => {
    imgEl.hidden = false;
    imgEl.onload = null;
  };
  imgEl.loading = 'eager';
  imgEl.src = url;
  if (imgEl.complete && imgEl.naturalWidth > 0) imgEl.hidden = false;
}

function initCreateLoadoutSection() {
  const input = document.getElementById('createChampSearchInput');
  const results = document.getElementById('createChampSearchResults');
  const hiddenChamp = document.getElementById('createChampionId');
  const summaryEl = document.getElementById('createChampSummary');
  const searchWrap = document.getElementById('createChampSearchWrap');
  const selectedImg = document.getElementById('createChampSelectedImg');
  const selectedName = document.getElementById('createChampSelectedName');
  const loadoutRoot = document.getElementById('create-loadout');
  if (!input || !results || !hiddenChamp || !summaryEl || !searchWrap || !selectedImg || !selectedName) {
    return;
  }

  function setResultsOpen(open) {
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderChampResults() {
    const rows = filterCreateFormChampions(input.value);
    results.innerHTML = rows
      .map(
        (c) => `
          <button type="button" class="create-search-hit" data-id="${escapeHtml(c.id)}" role="option">
            <img src="${escapeHtml(c.icon)}" alt="" width="32" height="32" loading="lazy" />
            <span>${escapeHtml(c.name)}</span>
          </button>
        `
      )
      .join('');
    const show = rows.length > 0;
    results.hidden = !show;
    setResultsOpen(show);
  }

  /**
   * @param {string} id
   */
  function applyChampionChoice(id) {
    const c = CREATE_FORM_CHAMPIONS.find((x) => x.id === id);
    if (!c) return;
    hiddenChamp.value = c.id;
    selectedImg.src = c.icon;
    selectedImg.alt = c.name;
    selectedName.textContent = c.name;
    selectedImg.removeAttribute('hidden');
    summaryEl.removeAttribute('hidden');
    searchWrap.setAttribute('hidden', '');
    input.value = '';
    results.innerHTML = '';
    results.hidden = true;
    setResultsOpen(false);
  }

  function clearChampion() {
    hiddenChamp.value = '';
    summaryEl.setAttribute('hidden', '');
    searchWrap.removeAttribute('hidden');
    /* Keep portrait + alt text until a new champion is chosen (no empty placeholder). */
    input.value = '';
    results.innerHTML = '';
    results.hidden = true;
    setResultsOpen(false);
  }

  input.addEventListener('input', () => renderChampResults());
  input.addEventListener('focus', () => renderChampResults());

  results.addEventListener('click', (e) => {
    const hit = e.target.closest('.create-search-hit');
    if (!hit) return;
    const id = hit.getAttribute('data-id');
    if (id) applyChampionChoice(id);
  });

  if (loadoutRoot) {
    loadoutRoot.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('#createChampClear');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      clearChampion();
    });
  }

  const s1 = document.getElementById('createSummoner1');
  const s2 = document.getElementById('createSummoner2');
  const i1 = document.getElementById('createSummoner1Img');
  const i2 = document.getElementById('createSummoner2Img');
  if (s1 && i1) {
    s1.addEventListener('change', () => updateCreateSummonerPreview(s1, i1));
    updateCreateSummonerPreview(s1, i1);
  }
  if (s2 && i2) {
    s2.addEventListener('change', () => updateCreateSummonerPreview(s2, i2));
    updateCreateSummonerPreview(s2, i2);
  }
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
  initCreateSearchCloseOnOutsideClick();
  initAugmentSection();
  initCreateLoadoutSection();
  initYoutubeHighlightSection();
  initCreateSubmitNameDialog();

  const mainHost = document.querySelector('.create-path-block[data-path-key="main"]');
  if (!mainHost) return;

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

function initCreateSubmitNameDialog() {
  const dialog = document.getElementById('createBuildNameDialog');
  const openBtn = document.getElementById('createSubmitBuildBtn');
  const panel = document.getElementById('createSubmitDialogPanel');
  const success = document.getElementById('createSubmitDialogSuccess');
  const input = document.getElementById('createSubmitDialogNameInput');
  const errEl = document.getElementById('createSubmitDialogError');
  const hiddenTitle = document.getElementById('createBuildTitle');
  const confirmBtn = document.getElementById('createSubmitDialogConfirm');
  const cancelBtn = document.getElementById('createSubmitDialogCancel');
  const closeBtn = document.getElementById('createSubmitDialogClose');
  const doneBtn = document.getElementById('createSubmitDialogDone');
  const successName = document.getElementById('createSubmitDialogSuccessName');
  const form = document.getElementById('createBuildForm');

  if (!dialog || !openBtn || !panel || !success || !input || !hiddenTitle || !confirmBtn) return;

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = !msg;
  }

  function resetToForm() {
    panel.hidden = false;
    success.hidden = true;
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');
  }

  function openDialog() {
    resetToForm();
    input.value = hiddenTitle.value.trim() || input.value.trim();
    showErr('');
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
    input.focus();
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
  }

  dialog.addEventListener('close', () => {
    resetToForm();
    input.value = '';
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  openBtn.addEventListener('click', () => {
    if (form) {
      /** @type {{ _youtubeSyncFns?: (() => void)[] }} */
      const f = form;
      const syncFns = f._youtubeSyncFns || [];
      syncFns.forEach((fn) => fn());
    }
    openDialog();
  });

  function onConfirm() {
    const name = input.value.trim();
    if (!name) {
      showErr('Give your build a title—this is the name players will see.');
      input.classList.add('create-submit-dialog-input--error');
      input.focus();
      return;
    }
    hiddenTitle.value = name;
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');
    panel.hidden = true;
    success.hidden = false;
    if (successName) successName.textContent = name;
    if (doneBtn) doneBtn.focus();
  }

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn?.addEventListener('click', () => closeDialog());
  closeBtn?.addEventListener('click', () => closeDialog());
  doneBtn?.addEventListener('click', () => closeDialog());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  });

  input.addEventListener('input', () => {
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');
  });
}

document.addEventListener('DOMContentLoaded', initCreateBuildPage);
