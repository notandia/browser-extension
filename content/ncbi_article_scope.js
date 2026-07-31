'use strict';

;(function scopeNcbiContextBridge() {
  const host = location.hostname.toLowerCase().replace(/^www\./, '');
  const pubmedArticle = host === 'pubmed.ncbi.nlm.nih.gov' && /^\/\d{1,12}\/?$/.test(location.pathname);
  const pmcArticle = host === 'pmc.ncbi.nlm.nih.gov' && /^\/articles\/PMC\d{1,12}\/?$/i.test(location.pathname);
  const articlePage = pubmedArticle || pmcArticle;

  window.notandiaNcbiArticlePage = articlePage;
  if ((host === 'pubmed.ncbi.nlm.nih.gov' || host === 'pmc.ncbi.nlm.nih.gov') && !articlePage) {
    window.notandiaNcbiContextBridgeInjected = true;
  }
})();
