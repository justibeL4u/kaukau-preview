/*
 * カウカウ 案 C「やさしい・地域密着」の動き
 *   1. モバイルのハンバーガーメニュー
 *   2. 現在位置に応じたナビの強調
 *   3. スクロールで現れる要素（IntersectionObserver）
 *   4. ページ上部へ戻るボタン
 * 予約フォームの検証と送信、完了表示へのフォーカス移動は ../assets/js/booking-form.js が担う（ここでは触らない）。
 * 動きは prefers-reduced-motion: reduce のとき止める（style.css 側でも止める）。
 */
(function () {
  'use strict';

  var NAV_WIDE_QUERY = '(min-width: 68.75em)'; // style.css のヘッダーの切り替え幅と同じ
  var CURRENT_BAND = '-45% 0px -50% 0px'; // 画面の縦の真ん中あたりの帯にかかった節を「いまの位置」とする
  var REVEAL_MARGIN = '0px 0px -8% 0px';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  // 古い Safari の MediaQueryList には addEventListener が無い
  function onMediaChange(query, handler) {
    if (query.addEventListener) query.addEventListener('change', handler);
    else query.addListener(handler);
  }

  function initNavToggle() {
    var header = document.querySelector('[data-header]');
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('site-nav');
    if (!header || !toggle || !nav) return;

    toggle.setAttribute('aria-controls', nav.id);
    toggle.hidden = false;
    header.classList.add('has-nav-toggle');

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      header.classList.toggle('is-nav-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });
    document.addEventListener('click', function (event) {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });
    onMediaChange(window.matchMedia(NAV_WIDE_QUERY), function () {
      setOpen(false);
    });
  }

  function initCurrentNav() {
    var links = document.querySelectorAll('.nav-list a[href^="#"]');
    if (!canObserve || !links.length) return;

    function mark(id) {
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) mark(entry.target.id);
      });
    }, { rootMargin: CURRENT_BAND });
    document.querySelectorAll('main section[id]').forEach(function (section) {
      observer.observe(section);
    });
  }

  function initReveal() {
    if (reduceMotion || !canObserve) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: REVEAL_MARGIN });

    var viewportHeight = window.innerHeight;
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      // 最初から画面に入っているものは動かさない（読み込み直後のちらつきを防ぐ）
      if (el.getBoundingClientRect().top < viewportHeight) return;
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

  function initToTop() {
    var link = document.querySelector('[data-to-top]');
    var hero = document.querySelector('[data-hero]');
    if (!link || !hero || !canObserve) return;

    new IntersectionObserver(function (entries) {
      link.classList.toggle('is-shown', !entries[0].isIntersecting);
    }).observe(hero);
  }

  initNavToggle();
  initCurrentNav();
  initReveal();
  initToTop();
}());
