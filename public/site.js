/* structs.app in the browser: hand the link to the desktop app, and copy it.
 *
 * The page is complete without this file — the card, the buttons and the
 * links are all in the HTML. This only brings the download forward when the
 * app did not take the link, and makes the copy button copy.
 */
(function () {
  'use strict';

  /* `structs://` opens the app if it is installed and does nothing at all if
   * it is not — the browser gives no error to catch. So: when the page is
   * still in front a moment after the click, the app did not take it, and
   * the download is brought forward. */
  function wireOpen() {
    var open = document.getElementById('open-app');
    var get = document.getElementById('get-app');
    if (!open || !get) return;
    open.addEventListener('click', function () {
      var left = false;
      var gone = function () { left = true; };
      window.addEventListener('blur', gone, { once: true });
      document.addEventListener('visibilitychange', gone, { once: true });
      setTimeout(function () {
        window.removeEventListener('blur', gone);
        document.removeEventListener('visibilitychange', gone);
        if (left) return;
        get.classList.add('site-nudge');
        get.focus();
      }, 1600);
    });
  }

  /* [data-copy] buttons copy their link, and say so for a moment. */
  function wireCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        var done = function () {
          btn.classList.add('site-copied');
          btn.setAttribute('aria-label', 'Link copied');
          setTimeout(function () { btn.classList.remove('site-copied'); btn.setAttribute('aria-label', 'Copy link'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
      });
    });
  }

  function start() { wireOpen(); wireCopy(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
