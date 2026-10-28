/* カウカウ 案A「誠実・信頼」の動き。
   1) ハンバーガーメニュー 2) スクロールで現れる要素 3) 現在位置に応じたナビの強調 4) ページ上部へ戻る
   動きは prefers-reduced-motion: reduce で止める（style.css 側でも止める）。予約フォームの送信は booking-form.js。 */
(function () {
  'use strict';

  var DESKTOP_QUERY = '(min-width: 67.5em)';       // style.css のヘッダーの切り替え幅と同じ
  var REVEAL_ROOT_MARGIN = '0px 0px -8% 0px';      // 画面の下 8% に入ってから現す
  var SPY_ROOT_MARGIN = '-40% 0px -55% 0px';       // 画面の上から 40〜45% の帯にある節を現在位置とする
  var HEADER_SHADOW_AFTER_PX = 8;
  var TO_TOP_AFTER_VIEWPORTS = 0.8;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var header = document.querySelector('[data-header]');

  document.documentElement.classList.add('js');

  // 古い Safari の MediaQueryList には addEventListener が無い
  function onMediaChange(query, handler) {
    if (query.addEventListener) query.addEventListener('change', handler);
    else query.addListener(handler);
  }

  function initMenu() {
    var button = document.querySelector('[data-menu-button]');
    var nav = document.getElementById('site-nav');
    if (!header || !button || !nav) return;

    button.setAttribute('aria-controls', nav.id);

    function isOpen() {
      return button.getAttribute('aria-expanded') === 'true';
    }

    function setOpen(open) {
      button.setAttribute('aria-expanded', String(open));
      header.classList.toggle('is-menu-open', open);
    }

    button.addEventListener('click', function () {
      var open = !isOpen();
      setOpen(open);
      var firstLink = nav.querySelector('a');
      if (open && firstLink) firstLink.focus();
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      button.focus();
    });

    // ヘッダーの外へフォーカスや操作が移ったら閉じる
    header.addEventListener('focusout', function (event) {
      if (isOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', function (event) {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });

    onMediaChange(window.matchMedia(DESKTOP_QUERY), function () {
      setOpen(false);
    });
  }

  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');

    function showAll() {
      targets.forEach(function (el) { el.classList.add('is-revealed'); });
    }

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: REVEAL_ROOT_MARGIN });

    targets.forEach(function (el) { observer.observe(el); });

    onMediaChange(reduceMotion, function (event) {
      if (!event.matches) return;
      observer.disconnect();
      showAll();
    });
  }

  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav-link]'));
    var sections = links
      .map(function (link) { return document.getElementById(link.hash.slice(1)); })
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    var inBand = new Set();

    function markCurrent() {
      var current = sections.find(function (section) { return inBand.has(section); });
      links.forEach(function (link) {
        if (current && link.hash === '#' + current.id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) inBand.add(entry.target);
        else inBand.delete(entry.target);
      });
      markCurrent();
    }, { rootMargin: SPY_ROOT_MARGIN });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function initScrollState() {
    var toTop = document.querySelector('[data-to-top]');
    var queued = false;

    function update() {
      queued = false;
      var y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > HEADER_SHADOW_AFTER_PX);
      if (toTop) toTop.classList.toggle('is-shown', y > window.innerHeight * TO_TOP_AFTER_VIEWPORTS);
    }

    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  initMenu();
  initReveal();
  initScrollSpy();
  initScrollState();
})();
