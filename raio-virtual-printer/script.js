// ------------------------
// Settings (URL params)
// ------------------------
const urlParams = new URLSearchParams(window.location.search);
const sbAddress = urlParams.get('address') || '127.0.0.1';
const sbPort = urlParams.get('port') || '8080';
const sbPassword = urlParams.get('password');
const deviceLocale = navigator.language || 'en-US';
const userLocale = urlParams.get('dateFormat') || deviceLocale;
const is24Hour = urlParams.get('timeFormat') === '24';
const debugMode = urlParams.get('debug') === '1';

// Single font-size teller override, e.g. ?fontSize=5vmin or ?fontSize=48px
const fontSizeOverride = urlParams.get('fontSize');
if (fontSizeOverride) {
  document.documentElement.style.setProperty('--base-font-size', fontSizeOverride);
}

// Discord webhook URL, e.g. ?webhookUrl=https%3A%2F%2Fdiscord.com%2Fapi%2Fwebhooks%2F...
// Can also be passed per-call in the "send-discord" command instead/as an override.
const defaultWebhookUrl = urlParams.get('webhookUrl') || '';

const dateFormat = new Intl.DateTimeFormat(userLocale, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const timeFormat = new Intl.DateTimeFormat(userLocale, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: !is24Hour
});

const widgetTitle = 'Receipt Renderer';
const notifications = document.querySelector('.notifications');
const receiptStage = document.getElementById('receiptStage');

let currentReceipt = null; // { id, el }

// ------------------------
// Streamer.bot connection (transport only -- no business logic here)
// ------------------------
let sbClientConnected = false;

const sbClient = new StreamerbotClient({
  host: sbAddress,
  port: sbPort,
  password: sbPassword,

  onConnect: () => {
    if (!sbClientConnected) {
      sbClientConnected = true;
      console.log(`✅ Streamer.bot Client connected to ${sbAddress}:${sbPort}`);
      createToast('success', widgetTitle, 'Connected to SB Client');
    }
  },

  onDisconnect: () => {
    if (sbClientConnected) {
      sbClientConnected = false;
      console.warn('❌ Streamer.bot Client disconnected');
      createToast('warning', widgetTitle, 'Disconnected from SB Client');
    }
  }
});

// CPH.WebsocketBroadcastJson(json) on the C# side arrives here as General.Custom,
// with the JSON you sent as a raw string in `data`.
sbClient.on('General.Custom', ({ data }) => {
  let payload;
  try {
    payload = typeof data === 'string' ? JSON.parse(data) : data;
  } catch (err) {
    console.error('Received malformed JSON over General.Custom:', data, err);
    createToast('error', widgetTitle, 'Received malformed JSON payload');
    return;
  }
  handleCommand(payload);
});

// ------------------------
// Command handling (the API's entry point)
// ------------------------
function handleCommand(payload) {
  if (!payload || typeof payload !== 'object') {
    console.error('handleCommand: payload must be an object', payload);
    return;
  }

  switch (payload.action) {
    case 'render':
      renderReceipt(payload);
      break;
    case 'clear':
      retireCurrent();
      break;
    case 'remove':
      if (currentReceipt && currentReceipt.id === payload.id) {
        retireCurrent();
      }
      break;
    case 'send-discord':
      sendReceiptToDiscord(payload);
      break;
    case 'scroll':
      scrollReceipt(payload);
      break;
    default:
      console.warn('handleCommand: unknown action', payload.action);
      createToast('warning', widgetTitle, `Unknown action: ${payload.action}`);
  }
}

// Exposed globally so other transports (a dev console, a different bridge) can
// drive the renderer without needing to know about Streamer.bot at all.
window.ReceiptAPI = { handleCommand };

// ------------------------
// Rendering
// ------------------------
function renderReceipt({ id, template, content = {} }) {
  const tpl = document.getElementById(template);
  if (!tpl) {
    console.error(`renderReceipt: no template found with id "${template}"`);
    createToast('error', widgetTitle, `Unknown template: ${template}`);
    return;
  }

  const now = new Date();
  const mergedContent = {
    date: `Date: ${dateFormat.format(now)}`,
    time: `Time: ${timeFormat.format(now)}`,
    ...content
  };

  const instance = tpl.content.cloneNode(true);
  const receipt = instance.querySelector('.receipt-paper');

  bindFields(receipt, mergedContent);

  // Cut whatever's on screen instantly, THEN append the new one and play the
  // print-in feed animation. Clearing/swapping itself is still instant --
  // only the entrance of a newly rendered receipt animates.
  retireCurrent();
  receiptStage.appendChild(receipt);

  // Dividers measure their own container width, so they can only be filled in
  // AFTER the element is in the DOM (a detached node has zero width).
  receipt.querySelectorAll('.divider').forEach(fillDivider);

  receipt.classList.add('printing');
  receipt.addEventListener('animationend', () => {
    receipt.classList.remove('printing');
  }, { once: true });

  currentReceipt = { id: id || null, el: receipt };
}

// Instantly removes whatever's currently showing. No animation, no delay.
function retireCurrent() {
  if (!currentReceipt) return;
  currentReceipt.el.remove();
  currentReceipt = null;
}

// Walks every [data-show-if] / [data-bind] element under `root` and fills it
// in from `data`. This is the entirety of the "template engine".
function bindFields(root, data) {
  root.querySelectorAll('[data-show-if]').forEach((el) => {
    let value = getPath(data, el.dataset.showIf);

    // Unwrap { html: ... } / { src: ... } objects (the same shapes data-bind
    // accepts) so a value like { html: "" } is judged on its actual content,
    // not on the fact that it's a non-null object.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('html' in value) value = value.html;
      else if ('src' in value) value = value.src;
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    el.style.display = isEmpty ? 'none' : '';
  });

  root.querySelectorAll('[data-bind]').forEach((el) => {
    let value = getPath(data, el.dataset.bind);
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      const sep = el.dataset.join !== undefined ? el.dataset.join.replace(/\\n/g, '\n') : '\n';
      value = value.join(sep);
    } else if (typeof value === 'object') {
      if ('html' in value) {
        el.innerHTML = value.html;
        return;
      }
      if ('src' in value) value = value.src;
    }

    if (el.tagName === 'IMG') {
      el.src = value;
    } else if (el.dataset.html === 'true') {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });
}

function getPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Fills a divider element with repeated * or - characters to span its
// container's width. Purely presentational -- not part of the API.
// IMPORTANT: `divider` must already be attached to the DOM when this runs --
// getBoundingClientRect() on a detached node is always 0x0, so this has to be
// called AFTER the receipt is appended to #receiptStage, never before.
function fillDivider(divider) {
  const char = divider.classList.contains('stars') ? '*' : '-';

  const testSpan = document.createElement('span');
  testSpan.style.visibility = 'hidden';
  testSpan.style.position = 'absolute';
  testSpan.textContent = char;
  divider.appendChild(testSpan);

  const charWidth = testSpan.getBoundingClientRect().width;
  divider.removeChild(testSpan);

  const containerWidth = divider.getBoundingClientRect().width;
  if (charWidth === 0 || containerWidth === 0) return;

  const numChars = Math.floor(containerWidth / charWidth);
  divider.textContent = char.repeat(numChars);
}

// ------------------------
// Scrolling (for receipts taller than the viewport -- e.g. a mass-gift
// with a long recipient list -- so the whole thing is readable on stream)
// ------------------------
let scrollAnimationFrame = null;

function scrollReceipt({ duration } = {}) {
  if (!currentReceipt) {
    console.error('scrollReceipt: no receipt currently on screen to scroll');
    createToast('error', widgetTitle, 'No receipt on screen to scroll');
    return;
  }

  const ms = Number(duration);
  const scrollDuration = Number.isFinite(ms) && ms > 0 ? ms : 3000;

  // .receipt-paper is what actually has overflow-y:auto / scrollHeight
  // beyond its own clientHeight -- #receiptStage just centers/bottom-aligns
  // it and clips with overflow:hidden, it never scrolls itself.
  const scrollEl = currentReceipt.el;

  const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
  if (maxScroll <= 0) return; // whole receipt already fits, nothing to scroll

  // Cancel any scroll already in progress rather than stacking animations.
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }

  const startScroll = scrollEl.scrollTop;
  const distance = maxScroll - startScroll;
  if (distance <= 0) return; // already at (or past) the bottom

  const startTime = performance.now();

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function step(now) {
    const t = Math.min((now - startTime) / scrollDuration, 1);
    scrollEl.scrollTop = startScroll + distance * easeInOutQuad(t);

    if (t < 1) {
      scrollAnimationFrame = requestAnimationFrame(step);
    } else {
      scrollAnimationFrame = null;
    }
  }

  scrollAnimationFrame = requestAnimationFrame(step);
}

// ------------------------
// Discord webhook export (same mechanism as the original project:
// html-to-image captures the receipt node, then it's POSTed to a
// Discord webhook as a file attachment)
// ------------------------
function sendReceiptToDiscord({ webhookUrl, username, avatarUrl } = {}) {
  const url = webhookUrl || defaultWebhookUrl;

  if (!url) {
    console.error('sendReceiptToDiscord: no webhook URL configured (pass "webhookUrl" or set ?webhookUrl= on the page)');
    createToast('error', widgetTitle, 'No Discord webhook URL configured');
    return;
  }

  if (!currentReceipt) {
    console.error('sendReceiptToDiscord: no receipt currently on screen to send');
    createToast('error', widgetTitle, 'No receipt on screen to send');
    return;
  }

  const node = currentReceipt.el;
  const scale = 3; // ensures high-resolution output regardless of the on-screen size

  htmlToImage.toBlob(node, {
    cacheBust: true,
    pixelRatio: scale,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left'
    }
  })
    .then((blob) => {
      if (!blob) throw new Error('htmlToImage produced an empty blob');

      const formData = new FormData();
      formData.append('file', blob, 'receipt.png');
      formData.append('payload_json', JSON.stringify({
        username: username || widgetTitle,
        avatar_url: avatarUrl || ''
      }));

      return fetch(url, { method: 'POST', body: formData });
    })
    .then(() => {
      createToast('success', widgetTitle, 'Sent receipt to Discord');
    })
    .catch((err) => {
      console.error('sendReceiptToDiscord: capture/send failed', err);
      createToast('error', widgetTitle, 'Failed to send receipt to Discord');
    });
}

// ------------------------
// Connection status toasts
// ------------------------
function createToast(type, title, text) {
  const newToast = document.createElement('div');
  newToast.innerHTML = `
    <div class="toast ${type}">
      <div class="content">
        <div class="title">${title}</div>
        <span>${text}</span>
      </div>
    </div>`;
  notifications.appendChild(newToast);
  setTimeout(() => newToast.remove(), 3000);
}

// ------------------------
// Debug panel (?debug=1 only) -- exercises the exact same API as production
// ------------------------
if (debugMode) {
  const panel = document.createElement('div');
  panel.id = 'debugPanel';
  document.body.appendChild(panel);

  const addBtn = (label, payload) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => handleCommand(payload);
    panel.appendChild(btn);
  };

  addBtn('Render: Standard Sub', {
    action: 'render',
    id: 'debug-standard',
    template: 'standard-receipt',
    content: {
      logo: 'assets/images/twitch-logo.png',
      event: 'NEW SUBSCRIBER',
      avatar: 'assets/images/profile-picture.png',
      username: 'rexbordz',
      tier: 'Tier 1',
      message: { html: "Let's gooo!" }
    }
  });

  addBtn('Render: Gift Sub', {
    action: 'render',
    id: 'debug-gift',
    template: 'gift-sub-receipt',
    content: {
      logo: 'assets/images/twitch-logo.png',
      fromAvatar: 'assets/images/profile-picture.png',
      fromUsername: 'rexbordz',
      totalGifted: 'rexbordz has gifted 24 subs in total!',
      toAvatar: 'assets/images/profile-picture.png',
      toUsername: 'a_lucky_viewer',
      tier: 'Tier 1'
    }
  });

  const massGiftBtn = document.createElement('button');
  massGiftBtn.textContent = 'Render: Mass Gift';
  massGiftBtn.onclick = () => {
    const giftCount = Math.floor(Math.random() * 100) + 1; // random 1-100
    const recipients = Array.from(
      { length: giftCount },
      (_, i) => `viewer_${i + 1}`
    );

    handleCommand({
      action: 'render',
      id: 'debug-massgift',
      template: 'multi-gift-receipt',
      content: {
        logo: 'assets/images/twitch-logo.png',
        fromAvatar: 'assets/images/profile-picture.png',
        fromUsername: 'rexbordz',
        tier: `${giftCount}x Tier 1`,
        totalGifted: `rexbordz has gifted ${giftCount} subs in total!`,
        recipients
      }
    });
  };
  panel.appendChild(massGiftBtn);

  addBtn('Render: Donation', {
    action: 'render',
    id: 'debug-donation',
    template: 'donation-receipt',
    content: {
      logo: 'assets/images/kofi-logo.png',
      username: 'rexbordz',
      amount: '$67.00',
      message: { html: 'Let\u2019s gooo!' }
    }
  });

  addBtn('Render: TikTok Gift', {
    action: 'render',
    id: 'debug-gifts',
    template: 'gifts-receipt',
    content: {
      logo: 'assets/images/tiktok-logo.png',
      event: 'GIFT',
      avatar: 'assets/images/profile-picture.png',
      username: 'rexbordz',
      amount: 'sent Rose x5',
      giftCount: 'x5',
      giftImage: 'assets/images/profile-picture.png'
    }
  });

  addBtn('Scroll Receipt', { action: 'scroll', duration: 3000 });

  addBtn('Clear', { action: 'clear' });

  addBtn('Send to Discord', { action: 'send-discord' });
}