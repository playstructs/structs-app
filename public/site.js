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
    // An iPad says it is a Mac, and cannot install the Mac app: it gets the releases page, and no nudge.
    if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) {
      get.href = get.getAttribute('data-releases');
      get.lastChild.textContent = 'Download Structs';
      return;
    }
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

  /* [data-copy] buttons, drawn hidden, appear where the browser can copy: they
   * copy their link, and say so for a moment, on screen and to a screen reader. */
  function wireCopy() {
    if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
      var icon = btn.querySelector('i');
      var status = btn.parentNode.querySelector('[role="status"]');
      var say = function (text) { if (status) status.textContent = text; };
      var timer = 0;
      btn.hidden = false;
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
          btn.classList.add('site-copied');
          icon.classList.replace('icon-copy', 'icon-success');
          say('Link copied');
          clearTimeout(timer);
          timer = setTimeout(function () {
            btn.classList.remove('site-copied');
            icon.classList.replace('icon-success', 'icon-copy');
            say('');
          }, 1600);
        }, function () { say('Could not copy the link'); });
      });
    });
  }

  function start() { wireOpen(); wireCopy(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
