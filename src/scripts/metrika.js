const COUNTERS_KEY = '__AZONE_YM_COUNTERS__';
const AUTO_BIND_KEY = '__AZONE_YM_AUTO_BIND__';
const ATTRIBUTION_KEY = '__AZONE_ATTRIBUTION__';
const ATTRIBUTION_BIND_KEY = '__AZONE_ATTRIBUTION_BIND__';
const BLOG_COMPLETION_KEY = '__AZONE_BLOG_COMPLETION_BIND__';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function normalizeCounters(counters) {
  return [...new Set((counters || []).map((id) => String(id).trim()).filter(Boolean))];
}

function getCounters() {
  if (typeof window === 'undefined') return [];
  return normalizeCounters(window[COUNTERS_KEY]);
}

function readStoredAttribution() {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStoredAttribution(data) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(data));
  } catch {
    // localStorage can be unavailable in strict privacy modes.
  }
}

function ensureHiddenInput(form, name, value) {
  if (!form || !name) return;
  let input = form.querySelector(`input[type="hidden"][name="${name}"]`);

  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
  }

  input.value = value || '';
}

function getPdfGoal(href) {
  const normalized = decodeURIComponent(href || '').toLowerCase();

  if (!normalized.includes('.pdf')) return '';
  if (normalized.includes('azone_ai_presentation.pdf')) return 'presentation_download';
  if (normalized.includes('oprosnik') || normalized.includes('опросник')) return 'oprosnik_download';
  if (normalized.includes('whitepaper')) return 'whitepaper_download';
  return 'pdf_download';
}

function getFileName(href) {
  try {
    const url = new URL(href, window.location.href);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.pathname);
  } catch {
    return href || '';
  }
}

export function getAttributionParams() {
  return readStoredAttribution();
}

export function captureMarketingAttribution() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const stored = readStoredAttribution();
  const next = { ...stored };
  const hasStoredFirstPage = Boolean(next.first_page);

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value && !next[key]) next[key] = value;
  });

  if (!hasStoredFirstPage) {
    next.first_page = window.location.pathname + window.location.search;
    next.referrer = document.referrer || '';
  }

  next.last_page = window.location.pathname + window.location.search;

  if (window.__AZONE_YM_CLIENT_ID__) {
    next.ym_client_id = window.__AZONE_YM_CLIENT_ID__;
  }

  writeStoredAttribution(next);
  return next;
}

export function requestYmClientId() {
  if (typeof window === 'undefined' || typeof window.ym !== 'function') return;
  if (window.__AZONE_YM_CLIENT_ID_REQUESTED__) return;
  window.__AZONE_YM_CLIENT_ID_REQUESTED__ = true;

  const [counterId] = getCounters();
  if (!counterId) return;

  try {
    window.ym(counterId, 'getClientID', (clientID) => {
      if (!clientID) return;
      window.__AZONE_YM_CLIENT_ID__ = clientID;
      const stored = readStoredAttribution();
      writeStoredAttribution({ ...stored, ym_client_id: clientID });
      document.querySelectorAll('form').forEach((form) => {
        ensureHiddenInput(form, 'ym_client_id', clientID);
      });
    });
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[YM client id error]', error);
    }
  }
}

export function populateFormAttribution(form) {
  if (typeof window === 'undefined' || !form) return {};

  const attribution = captureMarketingAttribution();
  UTM_KEYS.forEach((key) => ensureHiddenInput(form, key, attribution[key] || ''));
  ['first_page', 'last_page', 'referrer', 'ym_client_id'].forEach((key) => {
    ensureHiddenInput(form, key, attribution[key] || '');
  });

  return attribution;
}

export function bindAttributionCapture() {
  if (typeof window === 'undefined' || window[ATTRIBUTION_BIND_KEY]) return;
  window[ATTRIBUTION_BIND_KEY] = true;

  captureMarketingAttribution();
  requestYmClientId();

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement) {
        populateFormAttribution(form);
      }
    },
    true,
  );
}

function getDatasetParams(el) {
  const params = {};
  if (!el) return params;

  if (el.dataset.ymParams) {
    try {
      Object.assign(params, JSON.parse(el.dataset.ymParams));
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('[YM params parse error]', error);
      }
    }
  }

  for (const [key, value] of Object.entries(el.dataset)) {
    if (!key.startsWith('ymParam') || key === 'ymParams') continue;
    const name = key.slice('ymParam'.length);
    if (!name) continue;
    const normalizedName = name.charAt(0).toLowerCase() + name.slice(1);
    params[normalizedName] = value;
  }

  return params;
}

export function configureYmGoals(counters = []) {
  if (typeof window === 'undefined') return;
  window[COUNTERS_KEY] = normalizeCounters(counters);
  window.trackAnalyticsGoal = ymGoal;
}

export function ymGoal(goalName, params = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.ym !== 'function') return;
  if (!goalName) return;

  const safeParams = {
    page: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || '',
    ...params,
  };

  getCounters().forEach((counterId) => {
    try {
      window.ym(counterId, 'reachGoal', goalName, safeParams);
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('[YM goal error]', goalName, counterId, error);
      }
    }
  });

  if (import.meta.env?.DEV) {
    console.debug('[YM goal]', goalName, safeParams);
  }
}

export function bindYmAutoEvents() {
  if (typeof window === 'undefined' || window[AUTO_BIND_KEY]) return;
  window[AUTO_BIND_KEY] = true;

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-ym-goal]');
    if (target) {
      const href = target.href || target.getAttribute('href') || '';
      ymGoal(target.dataset.ymGoal, {
        text: target.textContent?.trim() || '',
        href,
        file: getPdfGoal(href) ? getFileName(href) : '',
        product: target.dataset.product || '',
        service: target.dataset.service || '',
        industry: target.dataset.industry || '',
        placement: target.dataset.placement || '',
        downloadType: target.dataset.downloadType || '',
        targetId: target.id || '',
        ...getDatasetParams(target),
      });
      return;
    }

    const link = event.target?.closest?.('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const text = link.textContent?.trim() || '';
    const baseParams = {
      text,
      href: link.href || href,
      product: link.dataset.product || '',
      service: link.dataset.service || '',
      industry: link.dataset.industry || '',
      placement: link.dataset.placement || '',
      downloadType: link.dataset.downloadType || '',
      targetId: link.id || '',
    };

    const pdfGoal = getPdfGoal(link.href || href);

    if (href.startsWith('tel:')) {
      ymGoal('phone_clicked', {
        ...baseParams,
        phone: href.replace(/^tel:/i, ''),
      });
    } else if (href.startsWith('mailto:')) {
      ymGoal('email_clicked', {
        ...baseParams,
        email: href.replace(/^mailto:/i, '').split('?')[0],
      });
    } else if (pdfGoal) {
      ymGoal(pdfGoal, {
        ...baseParams,
        file: getFileName(link.href || href),
      });
    } else if (href.startsWith('/contact/')) {
      ymGoal('contact_cta_click', baseParams);
    } else if (href.startsWith('/whitepaper/')) {
      ymGoal('whitepaper_cta_click', baseParams);
    } else if (/^https?:\/\//i.test(link.href) && link.host !== window.location.host) {
      ymGoal('external_link_click', baseParams);
    }
  });
}

export function bindBlogArticleCompletion() {
  if (typeof window === 'undefined' || window[BLOG_COMPLETION_KEY]) return;
  window[BLOG_COMPLETION_KEY] = true;

  const path = window.location.pathname;
  const match = path.match(/^\/blog\/([^/]+)\/?$/);
  if (!match) return;

  const articleSlug = match[1];
  if (!articleSlug) return;

  let timeReached = false;
  let scrollReached = false;
  let sent = false;

  function getScrollPercent() {
    const doc = document.documentElement;
    const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);
    return Math.round((window.scrollY / scrollable) * 100);
  }

  function maybeSend() {
    if (sent || !timeReached || !scrollReached) return;
    sent = true;
    ymGoal('blog_article_completed', {
      article_slug: articleSlug,
      scroll_percent: 80,
      time_seconds: 60,
    });
  }

  function onScroll() {
    if (getScrollPercent() >= 80) {
      scrollReached = true;
      window.removeEventListener('scroll', onScroll);
      maybeSend();
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.setTimeout(() => {
    timeReached = true;
    onScroll();
    maybeSend();
  }, 60000);
}
