(function() {
  'use strict';

  if (window.MDPIFilterLinkExtractor) {
    return; // Avoid re-injecting
  }

  // Flags to ensure Wiley/Healthline accordion/button is clicked only once per page scan/load
  let wileyReferencesExpanded = false;
  let healthlineSourcesExpanded = false;

  // Helper: check if current hostname exactly matches or is subdomain of given domain
  function isHostnameAllowed(domain) {
    const h = window.location.hostname.toLowerCase();
    return h === domain || h.endsWith('.' + domain);
  }

  // Wiley linkouts may contain both the citing article's DOI and the cited
  // work's refDoi/key. Only the latter identifies this bibliography entry.
  function referenceLinkValue(value) {
    try {
      const url = new URL(value, document.baseURI);
      if (/(^|\.)wiley\.com$/i.test(url.hostname) && url.pathname === '/servlet/linkout') {
        return url.searchParams.get('refDoi') || url.searchParams.get('key') || '';
      }
    } catch {}
    return value;
  }

  // Share the accumulated publisher-specific extraction rules with both the
  // watchlist and formal-integrity scanners. Reading evidence must not expand
  // accordions; secure_message_handler reveals a reference when navigated to.
  function extractReferenceValues(itemElement, linkSelectors) {
    const values = [];
    for (const config of linkSelectors || []) {
      for (const element of itemElement.querySelectorAll(config.selector)) {
        const attribute = config.attribute || 'href';
        let value = attribute === 'text' ? element.textContent : element.getAttribute(attribute);
        // Wikipedia COinS stores percent-encoded OpenURL fields in title.
        if (attribute === 'title' && element.matches('.Z3988')) {
          values.push(...new URLSearchParams(value || '').getAll('rft_id'));
          continue;
        }
        if (config.textPattern && value) value = value.match(config.textPattern)?.[0];
        if (value) values.push(attribute === 'href' ? referenceLinkValue(value.trim()) : value.trim());
      }
    }
    return [...new Set(values.filter(Boolean))];
  }

  /**
   * Extracts the primary link (DOI or other) from a reference item element.
   * It also handles expanding accordions on Wiley and Healthline if necessary.
   * @param {HTMLElement} itemElement - The DOM element representing the reference item.
   * @param {Array<Object>} linkSelectors - An array of selector configurations.
   *        Each object should have:
   *        - `selector`: CSS selector for the link element.
   *        - `type`: 'doi', 'pubmed', 'pmc', 'arxiv', 'generic', 'text'.
   *        - `attribute`: (Optional) The attribute to get the URL from (e.g., 'href', 'data-doi'). Defaults to 'href'.
   *        - `textPattern`: (Optional) Regex to extract DOI/ID from link's text content if attribute is not 'href'.
   * @returns {string|null} The extracted primary link URL, or null if not found.
   */
  function extractPrimaryLink(itemElement, linkSelectors) {
    // --- Wiley Online Library: Expand "References" accordion if hidden ---
    if (isHostnameAllowed('onlinelibrary.wiley.com') && !wileyReferencesExpanded) {
      const accordionControls = document.querySelectorAll('div.article-accordion .accordion__control[aria-expanded="false"]');
      accordionControls.forEach(control => {
        const titleElement = control.querySelector('.section__title');
        // Check if the title specifically indicates "References"
        if (titleElement && titleElement.textContent.trim().toLowerCase() === 'references') {
          // console.log('[MDPI Filter LE] Wiley: Found closed "References" accordion, attempting to click.');
          control.click();
          wileyReferencesExpanded = true; // Set flag after attempting click
        }
      });
    }

    // --- Healthline: Expand "Sources" button if present and not already expanded ---
    if (isHostnameAllowed('healthline.com') && !healthlineSourcesExpanded) {
      const sourcesButtons = document.querySelectorAll('button.css-5sudr5'); // Selector for the button
      sourcesButtons.forEach(button => {
        // Verify it's the "Sources" button by checking its text content.
        // Healthline structure: button > div > span (icon) + span (text)
        const textSpan = button.querySelector('div.css-rre5oz > span:last-child'); // More robustly get the text span
        if (textSpan && textSpan.textContent.trim().toLowerCase() === 'sources') {
          // console.log('[MDPI Filter LE] Healthline: Found "Sources" button, attempting to click.');
          button.click();
          healthlineSourcesExpanded = true; // Set flag after attempting click
        }
      });
    }

    // Iterate through the provided link selectors (now objects)
    for (const selectorConfig of linkSelectors) {
      const linkElement = itemElement.querySelector(selectorConfig.selector);

      if (linkElement) {
        let url = '';
        const attribute = selectorConfig.attribute || 'href';

        if (attribute === 'text') {
          const textContent = linkElement.textContent || '';
          if (selectorConfig.textPattern) {
            const match = textContent.match(selectorConfig.textPattern);
            if (match && match[0]) {
              url = match[0];
            }
          } else {
            url = textContent.trim();
          }
        } else if (attribute === 'data-doi' && linkElement.dataset && linkElement.dataset.doi) {
          url = linkElement.dataset.doi;
        } else if (linkElement.hasAttribute(attribute)) {
          url = linkElement.getAttribute(attribute);
        }

        if (url) {
          url = url.trim();
          if (selectorConfig.type === 'doi') {
            if (url.startsWith('10.')) {
              return `https://doi.org/${url}`;
            }
            try {
              const abs = new URL(url, document.baseURI);
              const host = abs.hostname.toLowerCase();
              if (host === 'doi.org' || host.endsWith('.doi.org')) {
                return abs.href;
              }
            } catch (e) {}
          } else if (selectorConfig.type === 'generic') {
            try {
              const absoluteUrl = new URL(url, document.baseURI).href;
              return absoluteUrl;
            } catch (e) {
              return url;
            }
          }
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
            return url;
          }
        }
      }
    }
    // console.log('[MDPI Filter LE] No primary link found for item:', itemElement.textContent.substring(0, 100) + "...");
    return null; // No primary link found
  }

  /**
   * Resets the expansion flags. This can be called if a full page re-scan is initiated
   * by the content script, in case accordions/buttons might have been closed.
   */
  function resetExpansionFlags() {
    wileyReferencesExpanded = false;
    healthlineSourcesExpanded = false;
    // console.log('[MDPI Filter LE] Expansion flags reset.');
  }

  window.MDPIFilterLinkExtractor = {
    extractReferenceValues,
    referenceLinkValue,
    extractPrimaryLink: extractPrimaryLink,
    resetExpansionFlags: resetExpansionFlags // Expose reset function
  };

})();
