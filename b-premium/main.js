/* カウカウ 案 B — 画面の動き。予約フォームの送信は ../assets/js/booking-form.js が担う。 */
(function () {
  'use strict';

  var SLIDE_INTERVAL_MS = 6000;
  var SLIDE_FADE_MS = 1400; // style.css の --dur-fade と合わせる
  var HEADER_TOP_PX = 24;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.add('js');

  // 古い Safari の MediaQueryList には addEventListener が無い
  function onMediaChange(query, handler) {
    if (query.addEventListener) query.addEventListener('change', handler);
    else query.addListener(handler);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // ページ最上部ではヘッダーを透明にし、写真を見せる
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-top', window.scrollY < HEADER_TOP_PX);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  // モバイルのハンバーガーメニュー
  function initNav() {
    var header = document.querySelector('[data-header]');
    var toggle = document.querySelector('[data-nav-toggle]');
    var panel = document.querySelector('[data-nav-panel]');
    if (!header || !toggle || !panel) return;
    var label = toggle.querySelector('[data-nav-toggle-label]');
    var desktop = window.matchMedia('(min-width: 75em)'); // style.css のナビ横並びの境目と合わせる

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('is-open', open);
      if (label) label.textContent = open ? '閉じる' : 'メニュー';
    }

    toggle.addEventListener('click', function () { setOpen(!isOpen()); });
    panel.addEventListener('click', function (event) {
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
    header.addEventListener('focusout', function (event) {
      if (isOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    onMediaChange(desktop, function (event) {
      if (event.matches) setOpen(false);
    });
  }

  // ヒーローのスライド：自動で切り替え、ドットで選べる。一時停止ボタンあり
  function initHero() {
    var hero = document.querySelector('[data-hero]');
    if (!hero) return;
    var slides = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-slide]'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-dot]'));
    var controls = hero.querySelector('[data-hero-controls]');
    var pauseButton = hero.querySelector('[data-hero-pause]');
    var caption = hero.querySelector('[data-hero-caption]');
    if (slides.length < 2 || dots.length !== slides.length || !controls || !pauseButton) return;

    var current = 0;
    var timer = 0;
    var pausedByUser = false;

    function render() {
      slides.forEach(function (slide, i) {
        var active = i === current;
        slide.classList.toggle('is-active', active);
        if (active) {
          slide.classList.remove('is-leaving');
          slide.removeAttribute('aria-hidden');
        } else {
          slide.setAttribute('aria-hidden', 'true');
        }
      });
      dots.forEach(function (dot, i) {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (caption) {
        caption.textContent = pad2(current + 1) + ' / ' + pad2(slides.length) + '　' + (slides[current].getAttribute('data-label') || '');
      }
    }

    function show(index) {
      if (index === current) return;
      // 前の写真はズームを保ったまま下に残し、新しい写真を上に重ねて溶かす
      var leaving = slides[current];
      leaving.classList.add('is-leaving');
      window.setTimeout(function () { leaving.classList.remove('is-leaving'); }, SLIDE_FADE_MS);
      current = index;
      render();
    }

    function shouldPlay() {
      return !reduceMotion.matches && !pausedByUser && !document.hidden;
    }
    function schedule() {
      window.clearInterval(timer);
      timer = shouldPlay() ? window.setInterval(function () { show((current + 1) % slides.length); }, SLIDE_INTERVAL_MS) : 0;
    }
    function updatePauseButton() {
      pauseButton.hidden = reduceMotion.matches;
      pauseButton.classList.toggle('is-paused', pausedByUser);
      pauseButton.setAttribute('aria-label', pausedByUser ? 'スライドを再生' : 'スライドを一時停止');
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        show(i);
        schedule();
      });
    });
    pauseButton.addEventListener('click', function () {
      pausedByUser = !pausedByUser;
      updatePauseButton();
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    onMediaChange(reduceMotion, function () {
      updatePauseButton();
      schedule();
    });

    controls.hidden = false;
    updatePauseButton();
    render();
    schedule();
  }

  // スクロールで現れる要素（動きを減らす設定では CSS 側で最初から見せる）
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(function (el) { observer.observe(el); });
  }

  // 画面の中ほどにあるセクションに合わせて、ナビの現在地を強調する
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav-link]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var sections = [];
    links.forEach(function (link) {
      var section = document.getElementById(link.getAttribute('href').slice(1));
      if (section) sections.push({ el: section, link: link, visible: false });
    });

    function update() {
      var currentItem = null;
      sections.forEach(function (item) { if (item.visible) currentItem = item; });
      sections.forEach(function (item) {
        if (item === currentItem) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        sections.forEach(function (item) {
          if (item.el === entry.target) item.visible = entry.isIntersecting;
        });
      });
      update();
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (item) { observer.observe(item.el); });
  }

  initHeader();
  initNav();
  initHero();
  initReveal();
  initScrollSpy();
})();
