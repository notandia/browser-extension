// content/domains.js
// Search-site configuration for Notandia.
const notandiaDomains = {
  // Built-in MDPI publisher evidence retained as a publisher-specific rule.
  mdpiDomains: ["mdpi.com", "mdpi.org"],

  searchEngineDomains: [
    "www.google.com",
    "scholar.google.com",
    "pubmed.ncbi.nlm.nih.gov",
    "europepmc.org",
    "www.bing.com",
    "duckduckgo.com",
    "yandex.com",
    "yandex.ru",
    "ya.ru",
    "yandex.by",
    "yandex.kz",
    "yandex.uz",
    "yandex.com.tr",
    "yandex.az",
    "yandex.com.ge",
    "yandex.com.am",
    "yandex.co.il",
    "yandex.md",
    "yandex.tm",
    "yandex.tj",
    "yandex.eu"
  ],

  googleWeb: {
    hostRegex: /^www\.google\.[a-z.]+$/i,
    isGoogleWeb: true,
    path: /^\/search/,
    // Ordinary organic results only. Google AI Overview and People Also Ask are
    // decomposed into their individual sources/questions by the publisher scanner
    // so one source cannot incorrectly style an entire generated-answer module.
    itemSelector: 'div.MjjYud:not(:has(div#iur)):not(:has(.related-question-pair)):not(:has([data-subtree="mfc"])), div#iur div[jsname="qQjpJ"]',
    linkSelector: 'a[href*="mdpi.com"], a[href*="mdpi.org"]',
    useNcbiApi: true,
    googleSpecialModules: true,
    highlightTargetSelector: 'div.N54PNb, div.AP7Wnd, div.VTuCfe, div.VwiC3b, div.maxWxw, div.ULSxyf div.N54PNb'
  },

  scholar: {
    host: 'scholar.google.com',
    itemSelector: 'div.gs_r',
    linkSelector: 'a[href*="mdpi.com"], a[href*="mdpi.org"]',
    useNcbiApi: true
  },

  bing: {
    hostRegex: /^www\.bing\.com$/i,
    isBingWeb: true,
    path: /^\/search/,
    itemSelector: 'li.b_algo, div.b_cards2.slide, div.slide[role="listitem"]',
    linkSelector: 'a[href*="mdpi.com"], a[href*="mdpi.org"]',
    useNcbiApi: true,
    highlightTargetSelector: null
  },

  pubmed: {
    host: 'pubmed.ncbi.nlm.nih.gov',
    path: /(?:\?|^\/(?:search|collections)\/)/i,
    itemSelector: 'article.full-docsum, li.full-docsum',
    doiPattern: '10.3390',
    useNcbiApi: true
  },

  europepmc: {
    hostRegex: /europepmc\.org$/,
    path: /^\/search/,
    itemSelector: 'li.separated-list-item',
    useNcbiApi: true
  },

  duckDuckGo: {
    hostRegex: /^duckduckgo\.com$/i,
    isDuckDuckGo: true,
    path: /^\//,
    itemSelector: 'li[data-layout="organic"] article',
    linkSelector: 'a[href*="mdpi.com"], a[href*="mdpi.org"]',
    useNcbiApi: true,
    highlightTargetSelector: null
  },

  yandex: {
    hostRegex: /^([a-z0-9-]+\.)?yandex\.(com(?:\.tr)?|ru|by|kz|uz|az|com\.ge|com\.am|co\.il|md|tm|tj|eu)$/i,
    isYandex: true,
    path: /^\/search/,
    itemSelector: 'li[data-fast]',
    linkSelector: 'a[href*="mdpi.com"], a[href*="mdpi.org"]',
    useNcbiApi: true,
    highlightTargetSelector: null
  }
};

window.NotandiaDomains = notandiaDomains;

// Compatibility aliases are intentionally retained for released installations and
// the mature detector while callers migrate to the Notandia namespace.
window.MDPIFilterDomains = window.NotandiaDomains;
window.NotandiaDomainUtils = window.NotandiaDomainUtils || {};

window.NotandiaDomainUtils.getActiveSearchConfig = function(currentHostname, currentPathname, allDomainConfigs = window.NotandiaDomains) {
  if (!allDomainConfigs) return null;

  const configsToConsider = [
    allDomainConfigs.googleWeb,
    allDomainConfigs.scholar,
    allDomainConfigs.bing,
    allDomainConfigs.duckDuckGo,
    allDomainConfigs.yandex,
    allDomainConfigs.pubmed,
    allDomainConfigs.europepmc
  ];

  for (const config of configsToConsider) {
    if (!config) continue;
    let hostMatch = false;
    if (config.host) hostMatch = currentHostname === config.host;
    else if (config.hostRegex) hostMatch = config.hostRegex.test(currentHostname);
    if (!hostMatch) continue;

    let pathMatch = true;
    if (config.path) {
      if (config.host === 'pubmed.ncbi.nlm.nih.gov') {
        pathMatch = config.path.test(currentPathname + window.location.search);
      } else {
        pathMatch = config.path.test(currentPathname);
      }
    }
    if (!pathMatch) continue;

    if (config === allDomainConfigs.europepmc) {
      const listed = allDomainConfigs.searchEngineDomains?.some(
        domain => currentHostname.includes(domain) && domain === 'europepmc.org'
      );
      if (listed) return config;
      continue;
    }
    return config;
  }
  return null;
};

// Legacy runtime alias; do not use in new code.
window.MDPIFilterDomainUtils = window.NotandiaDomainUtils;
