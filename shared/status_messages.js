'use strict';

;(function exposeStatusMessages(root) {
  root.NotandiaStatusMessages = Object.freeze({
    create(element, durationMs) {
      let version = 0;
      return message => {
        const currentVersion = ++version;
        element.textContent = message;
        if (message) setTimeout(() => {
          if (version === currentVersion) element.textContent = '';
        }, durationMs);
      };
    }
  });
})(globalThis);
