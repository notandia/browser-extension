'use strict';

;(function exposeIntegrityModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MDPIIntegrity = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const STATUS_DEFINITIONS = Object.freeze({
    retracted: Object.freeze({
      key: 'retracted', label: 'Retracted', shortLabel: 'Retracted', icon: '×', color: '#B42318', severity: 100
    }),
    'expression-of-concern': Object.freeze({
      key: 'expression-of-concern', label: 'Expression of concern', shortLabel: 'Concern', icon: '!', color: '#B54708', severity: 80
    }),
    withdrawn: Object.freeze({
      key: 'withdrawn', label: 'Withdrawn or removed', shortLabel: 'Withdrawn', icon: '–', color: '#475467', severity: 70
    }),
    'duplicate-publication': Object.freeze({
      key: 'duplicate-publication', label: 'Duplicate publication', shortLabel: 'Duplicate', icon: '≡', color: '#6941C6', severity: 60
    }),
    corrected: Object.freeze({
      key: 'corrected', label: 'Corrected', shortLabel: 'Corrected', icon: '✎', color: '#175CD3', severity: 40
    }),
    reinstated: Object.freeze({
      key: 'reinstated', label: 'Reinstated', shortLabel: 'Reinstated', icon: '↩', color: '#067647', severity: 30
    })
  });

  const TYPE_MAP = new Map([
    ['retraction', 'retracted'], ['retracted', 'retracted'], ['partial_retraction', 'retracted'], ['partialretraction', 'retracted'],
    ['expression_of_concern', 'expression-of-concern'], ['expressionofconcern', 'expression-of-concern'], ['concern', 'expression-of-concern'],
    ['withdrawal', 'withdrawn'], ['withdrawn', 'withdrawn'], ['removal', 'withdrawn'], ['removed', 'withdrawn'],
    ['correction', 'corrected'], ['corrected', 'corrected'], ['corrigendum', 'corrected'], ['erratum', 'corrected'],
    ['addendum', 'corrected'], ['clarification', 'corrected'], ['reinstatement', 'reinstated'], ['reinstated', 'reinstated'],
    ['retraction_reversal', 'reinstated'], ['reversal', 'reinstated'], ['duplicate_publication', 'duplicate-publication'],
    ['duplicatepublication', 'duplicate-publication'], ['duplication', 'duplicate-publication']
  ]);

  function normalizedToken(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function normalizeDOI(value) {
    if (typeof value !== 'string') return null;
    let normalized = value.trim();
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep malformed percent-encoded input unchanged.
    }
    normalized = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(normalized) ? normalized : null;
  }

  function normalizeUpdateType(type, label = '') {
    const direct = TYPE_MAP.get(normalizedToken(type));
    if (direct) return direct;
    const fromLabel = TYPE_MAP.get(normalizedToken(label));
    if (fromLabel) return fromLabel;
    const combined = `${type || ''} ${label || ''}`.toLowerCase();
    if (/duplicate|redundant publication/.test(combined)) return 'duplicate-publication';
    if (/reinstate|reversal/.test(combined)) return 'reinstated';
    if (/expression.*concern/.test(combined)) return 'expression-of-concern';
    if (/partial.*retract|retract/.test(combined)) return 'retracted';
    if (/withdraw|remov/.test(combined)) return 'withdrawn';
    if (/correct|corrig|errat|addend|clarif/.test(combined)) return 'corrected';
    return null;
  }

  function eventTimestamp(update) {
    const explicit = Number(update?.updated?.timestamp);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    for (const value of [update?.updated?.['date-time'], update?.date]) {
      const parsed = Date.parse(value || '');
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function eventDate(update, timestamp) {
    const explicit = update?.updated?.['date-time'] || update?.date;
    if (typeof explicit === 'string' && explicit.trim()) return explicit;
    return timestamp ? new Date(timestamp).toISOString() : null;
  }

  function normalizeCrossrefEvents(message) {
    if (!message || typeof message !== 'object') return [];
    const updates = Array.isArray(message['updated-by']) ? message['updated-by'].slice(0, 100) : [];
    const events = [];
    const seen = new Set();
    for (const update of updates) {
      if (!update || typeof update !== 'object') continue;
      const status = normalizeUpdateType(update.type, update.label);
      if (!status) continue;
      const noticeDoi = normalizeDOI(update.DOI || update.doi || '');
      const timestamp = eventTimestamp(update);
      const source = String(update.source || 'publisher').trim().toLowerCase();
      const recordId = update['record-id'] ?? update.recordId ?? null;
      const key = [status, noticeDoi || '', timestamp || '', source, recordId || ''].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        status,
        label: STATUS_DEFINITIONS[status].label,
        type: String(update.type || '').trim() || status,
        noticeDoi,
        source,
        recordId,
        date: eventDate(update, timestamp),
        timestamp
      });
    }
    return events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return STATUS_DEFINITIONS[b.status].severity - STATUS_DEFINITIONS[a.status].severity;
    });
  }

  function normalizeCrossrefUpdateRecords(items, queriedDoi) {
    const targetDoi = normalizeDOI(queriedDoi || '');
    if (!targetDoi || !Array.isArray(items)) return [];
    const updatedBy = [];
    for (const item of items.slice(0, 100)) {
      if (!item || typeof item !== 'object') continue;
      const noticeDoi = normalizeDOI(item.DOI || item.doi || '');
      const relations = Array.isArray(item['update-to']) ? item['update-to'] : [];
      for (const relation of relations) {
        if (!relation || normalizeDOI(relation.DOI || relation.doi || '') !== targetDoi) continue;
        updatedBy.push({
          DOI: noticeDoi,
          type: relation.type,
          label: relation.label,
          source: relation.source || item.source || 'crossref',
          'record-id': relation['record-id'] ?? relation.recordId ?? null,
          updated: relation.updated || item.updated || item.created || item.published || null,
          date: relation.date || item?.published?.['date-time'] || item?.created?.['date-time'] || null
        });
      }
    }
    return normalizeCrossrefEvents({ 'updated-by': updatedBy });
  }

  function derivePrimaryStatus(events) {
    const list = Array.isArray(events) ? events : [];
    if (!list.length) return null;
    let latestRetraction = -1;
    let latestReinstatement = -1;
    let latestConcern = -1;
    let hasCorrection = false;
    let hasDuplicate = false;
    let hasWithdrawal = false;
    for (const event of list) {
      const timestamp = Number.isFinite(event?.timestamp) ? event.timestamp : 0;
      if (event?.status === 'retracted') latestRetraction = Math.max(latestRetraction, timestamp);
      else if (event?.status === 'reinstated') latestReinstatement = Math.max(latestReinstatement, timestamp);
      else if (event?.status === 'expression-of-concern') latestConcern = Math.max(latestConcern, timestamp);
      else if (event?.status === 'corrected') hasCorrection = true;
      else if (event?.status === 'duplicate-publication') hasDuplicate = true;
      else if (event?.status === 'withdrawn') hasWithdrawal = true;
    }
    if (latestRetraction >= 0 && latestRetraction > latestReinstatement) return 'retracted';
    if (latestConcern >= 0 && latestConcern > latestRetraction && latestConcern > latestReinstatement) return 'expression-of-concern';
    if (latestReinstatement >= 0 && latestReinstatement >= latestRetraction) return 'reinstated';
    if (hasWithdrawal) return 'withdrawn';
    if (hasDuplicate) return 'duplicate-publication';
    if (hasCorrection) return 'corrected';
    return null;
  }

  function summarizeIntegrityRecords(records, totalRequested = 0) {
    const normalizedRecords = Array.isArray(records) ? records : [];
    const counts = Object.fromEntries(Object.keys(STATUS_DEFINITIONS).map(key => [key, 0]));
    let checked = 0;
    let failed = 0;
    let affected = 0;
    let primaryStatus = null;
    for (const record of normalizedRecords) {
      if (record?.lookupStatus === 'checked') checked += 1;
      else if (record?.lookupStatus === 'failed' || record?.lookupStatus === 'not-found') failed += 1;
      const statuses = new Set((record?.events || []).map(event => event.status).filter(Boolean));
      for (const status of statuses) if (Object.hasOwn(counts, status)) counts[status] += 1;
      if (record?.primaryStatus) {
        affected += 1;
        if (!primaryStatus || STATUS_DEFINITIONS[record.primaryStatus].severity > STATUS_DEFINITIONS[primaryStatus].severity) {
          primaryStatus = record.primaryStatus;
        }
      }
    }
    return {
      total: Math.max(Number(totalRequested) || 0, normalizedRecords.length), checked, failed, affected, counts, primaryStatus
    };
  }

  function badgeForSummary(summary) {
    if (!summary?.affected || !summary.primaryStatus) {
      return { count: 0, color: '#667085', title: 'No known integrity signals' };
    }
    const definition = STATUS_DEFINITIONS[summary.primaryStatus];
    return {
      count: Math.min(999, Math.max(0, Number(summary.affected) || 0)),
      color: definition.color,
      title: `${summary.affected} reference${summary.affected === 1 ? '' : 's'} with known integrity signals`
    };
  }

  function createStartRateLimiter(intervalMs = 250, now = () => Date.now(), sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))) {
    if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new TypeError('intervalMs must be a non-negative number');
    let nextStartAt = 0;
    let queue = Promise.resolve();
    return function waitForStartSlot() {
      const operation = queue.then(async () => {
        const current = Number(now());
        const scheduled = Math.max(current, nextStartAt);
        nextStartAt = scheduled + intervalMs;
        if (scheduled > current) await sleep(scheduled - current);
        return scheduled;
      });
      queue = operation.catch(() => undefined);
      return operation;
    };
  }

  return Object.freeze({
    STATUS_DEFINITIONS,
    badgeForSummary,
    createStartRateLimiter,
    derivePrimaryStatus,
    normalizeCrossrefEvents,
    normalizeCrossrefUpdateRecords,
    normalizeDOI,
    normalizeUpdateType,
    summarizeIntegrityRecords
  });
});
