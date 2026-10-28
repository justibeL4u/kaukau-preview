/* 出張査定の予約フォーム（3 案で共通）。仕様は docs/brief.md 第 4 節。 */
(function () {
  'use strict';

  var TEL_PATTERN = /^[0-9-]{10,13}$/;
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SEND_TIMEOUT_MS = 20000;

  var REQUIRED_MESSAGES = {
    name: 'お名前を入力してください。',
    tel: '電話番号を入力してください。',
    address: 'ご住所を市区町村まで入力してください。',
    date1: '第 1 希望日を選んでください。',
    items: '品目を 1 つ以上選んでください。',
    agree: '個人情報の取り扱いをご確認のうえ、「同意する」にチェックを入れてください。'
  };
  var MSG_REQUIRED_DEFAULT = 'この項目を入力してください。';
  var MSG_TEL_FORMAT = '電話番号は数字とハイフンで、10〜13 文字で入力してください（例：06-4309-5212）。';
  var MSG_EMAIL_FORMAT = 'メールアドレスの形式が正しくありません。「name@example.jp」の形で入力してください。';
  var MSG_DATE_TOO_EARLY = '希望日は明日以降の日付を選んでください。';
  var MSG_DATE2_BEFORE_DATE1 = '第 2 希望日は、第 1 希望日と同じ日かそれより後の日付を選んでください。';
  var MSG_TURNSTILE = '迷惑送信対策の確認が済んでいません。表示されている確認を済ませてから、もう一度お申し込みください。';
  var MSG_TRIAL = '試作版のため送信していません。本番ではここで受付完了になります。';
  var MSG_FAILED = '送信できませんでした。お電話（06-4309-5212）でもご予約いただけます。';

  function toDateValue(date) {
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + mm + '-' + dd;
  }

  function field(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function setStatus(form, text) {
    var status = form.querySelector('[data-form-status]');
    if (status) status.textContent = text;
  }

  function findDone(form) {
    for (var node = form.parentElement; node; node = node.parentElement) {
      var done = node.querySelector('[data-booking-done]');
      if (done) return done;
    }
    return null;
  }

  // 押したボタンがフォームごと隠れてフォーカスが迷子になるので、完了表示へ移して読み上げさせる
  function showDone(form) {
    form.hidden = true;
    var done = findDone(form);
    if (!done) return null;
    done.hidden = false;
    if (!done.hasAttribute('tabindex')) done.setAttribute('tabindex', '-1');
    done.focus();
    return done;
  }

  function setDoneNote(done, text) {
    if (!done) return;
    var note = done.querySelector('[data-booking-note]');
    if (!note) {
      note = document.createElement('p');
      note.setAttribute('data-booking-note', '');
      done.insertBefore(note, done.firstChild);
    }
    note.textContent = text;
  }

  function dateError(form, el) {
    if (!el.min || el.value >= el.min) return '';
    var date1 = field(form, 'date1');
    var afterDate1 = el.name === 'date2' && date1 && date1.value && el.min === date1.value;
    return afterDate1 ? MSG_DATE2_BEFORE_DATE1 : MSG_DATE_TOO_EARLY;
  }

  function fieldError(form, el) {
    var value = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (el.required && !value) return REQUIRED_MESSAGES[el.name] || MSG_REQUIRED_DEFAULT;
    if (!value) return '';
    if (el.name === 'tel' && !TEL_PATTERN.test(value)) return MSG_TEL_FORMAT;
    if (el.type === 'email' && !EMAIL_PATTERN.test(value)) return MSG_EMAIL_FORMAT;
    if (el.type === 'date') return dateError(form, el);
    return '';
  }

  // 戻り値はフォームの並び順のエラー一覧 [{ name, el, message }]
  function validate(form) {
    var errors = [];
    var itemsAt = -1;
    var itemsChecked = false;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.name === 'items') {
        if (itemsAt < 0) itemsAt = errors.length;
        if (el.checked) itemsChecked = true;
        return;
      }
      var message = fieldError(form, el);
      if (message) errors.push({ name: el.name, el: el, message: message });
    });
    if (itemsAt >= 0 && !itemsChecked) {
      errors.splice(itemsAt, 0, { name: 'items', el: field(form, 'items'), message: REQUIRED_MESSAGES.items });
    }
    return errors;
  }

  function showErrors(form, errors) {
    form.querySelectorAll('[data-error-for]').forEach(function (p) { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    errors.forEach(function (error) {
      var slot = form.querySelector('[data-error-for="' + error.name + '"]');
      if (slot) slot.textContent = error.message;
      error.el.setAttribute('aria-invalid', 'true');
    });
    if (errors.length) errors[0].el.focus();
  }

  function looksLikeSpam(form) {
    var honeypot = field(form, 'website');
    if (honeypot && honeypot.value !== '') return true;
    var startedAt = Number((field(form, 'started_at') || {}).value);
    var minSeconds = Number(form.getAttribute('data-min-seconds')) || 0;
    return Date.now() - startedAt < minSeconds * 1000;
  }

  function turnstilePending(form) {
    if (!form.querySelector('.cf-turnstile')) return false;
    var response = field(form, 'cf-turnstile-response');
    return !response || response.value === '';
  }

  function send(form, endpoint) {
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    // AbortSignal.timeout は古い iOS に無いので、AbortController とタイマーで中断する
    var controller = new AbortController();
    var timeoutMs = Number(form.getAttribute('data-timeout-ms')) || SEND_TIMEOUT_MS;
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return window.fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      signal: controller.signal
    }).finally(function () {
      clearTimeout(timer);
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
    }).then(function () {
      showDone(form);
    }, function () {
      setStatus(form, MSG_FAILED);
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function onSubmit(event) {
    var form = event.currentTarget;
    event.preventDefault();
    setStatus(form, '');
    var errors = validate(form);
    showErrors(form, errors);
    if (errors.length) return;
    // スパムには手掛かりを与えないため、送らずに完了表示にする
    if (looksLikeSpam(form)) {
      showDone(form);
      return;
    }
    if (turnstilePending(form)) {
      setStatus(form, MSG_TURNSTILE);
      return;
    }
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    if (!endpoint) {
      setStatus(form, MSG_TRIAL);
      // 状態欄はフォームと一緒に隠れるので、完了表示にも同じ文を出す
      setDoneNote(showDone(form), MSG_TRIAL);
      return;
    }
    send(form, endpoint);
  }

  function init(form) {
    var startedAt = field(form, 'started_at');
    if (startedAt) startedAt.value = String(Date.now());
    var next = new Date();
    next.setDate(next.getDate() + 1);
    var tomorrow = toDateValue(next);
    form.querySelectorAll('input[type="date"]').forEach(function (el) { el.min = tomorrow; });
    var date1 = field(form, 'date1');
    var date2 = field(form, 'date2');
    if (date1 && date2) {
      date1.addEventListener('change', function () {
        date2.min = date1.value > tomorrow ? date1.value : tomorrow;
      });
    }
    form.addEventListener('submit', onSubmit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-booking]').forEach(init);
  });
})();
