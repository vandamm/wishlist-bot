// src/frontend.ts
export const INDEX_HTML = /* html */`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Вишлист</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #f0f5fd; color: #2d2d2d; min-height: 100vh; }

:root {
  --accent: #7a9ec9;
  --accent-dark: #4f7aaa;
  --accent-light: #e8f0fa;
  --border: #d8e4f0;
  --bg: #fff;
  --text: #2d2d2d;
  --muted: #7a8fa8;
  --subtle: #f0f5fd;
}

.header { background: var(--accent); color: #fff; padding: 14px 16px; font-weight: 600; font-size: 16px; position: sticky; top: 0; z-index: 10; }
.add-form { background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.add-form input { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 14px; outline: none; color: var(--text); width: 100%; background: var(--bg); }
.add-form input:focus { border-color: var(--accent); }
.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; }
.btn-primary:active { background: var(--accent-dark); }
.stats-bar { background: var(--subtle); border-bottom: 1px solid var(--border); padding: 8px 14px; font-size: 12px; color: var(--muted); }
.stats-bar strong { color: var(--accent-dark); }
.budget-bar { background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 14px; }
.budget-label { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
.budget-row { display: flex; align-items: center; gap: 10px; }
.budget-row input[type=range] { flex: 1; accent-color: var(--accent); }
.budget-num { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; width: 70px; text-align: center; font-size: 13px; color: var(--text); background: var(--bg); }
.budget-unit { font-size: 13px; color: var(--muted); font-weight: 600; }
.budget-hint { font-size: 11px; color: #aaa; margin-top: 6px; }
.item-list { padding: 4px 0; }
.item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--subtle); background: var(--bg); }
.item:last-child { border-bottom: none; }
.item-img { width: 46px; height: 46px; border-radius: 8px; background: var(--accent-light); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden; }
.item-img img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.item-body { flex: 1; min-width: 0; }
.item-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
.item-meta a { color: var(--accent-dark); text-decoration: none; }
.btn-claim { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 7px 13px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.btn-unclaim { background: var(--bg); color: var(--accent-dark); border: 1.5px solid var(--accent); border-radius: 8px; padding: 6px 13px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.btn-delete { background: none; border: none; color: #ccc; font-size: 18px; cursor: pointer; padding: 4px; flex-shrink: 0; }
.btn-delete:hover { color: #e07a5f; }
.footer-note { padding: 10px 14px; font-size: 12px; color: #aaa; text-align: center; }
.error-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #2d2d2d; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; z-index: 100; display: none; }
.loading { text-align: center; padding: 40px 20px; color: var(--muted); font-size: 14px; }
.hidden { display: none !important; }
</style>
</head>
<body>

<div id="app">
  <div class="loading">Загрузка...</div>
</div>
<div class="error-toast" id="toast"></div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const initData = tg.initData;
let state = { isOwner: false, items: [], claimedCount: 0, budget: 100, myClaimedIds: new Set() };

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'X-Telegram-Init-Data': initData,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { showToast('Ошибка авторизации'); throw new Error('401'); }
  return res;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', duration);
}

function emojiFor(name) {
  const n = name.toLowerCase();
  if (n.includes('книг')) return '📖';
  if (n.includes('духи') || n.includes('парфюм')) return '🌸';
  if (n.includes('наушник') || n.includes('airpod')) return '🎧';
  if (n.includes('йога') || n.includes('коврик')) return '🧘';
  if (n.includes('шарф') || n.includes('платок')) return '🧣';
  if (n.includes('обув') || n.includes('туфл')) return '👟';
  if (n.includes('сумк')) return '👜';
  return '🎁';
}

function formatPrice(min, max) {
  if (min === null) return '';
  if (min === max) return min + '€';
  return min + '–' + max + '€';
}

async function loadItems() {
  const res = await api('GET', '/api/items');
  const data = await res.json();
  state.isOwner = data.is_owner;
  state.claimedCount = data.claimed_count;
  state.items = data.items;
  // Set slider max to highest price
  const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(Boolean));
  state.budget = maxPrice;
  render();
}

function render() {
  document.getElementById('app').innerHTML = state.isOwner ? renderOwner() : renderFriend();
  attachEvents();
}

function renderOwner() {
  const itemsHtml = state.items.map(item => \`
    <div class="item" data-id="\${item.id}">
      <div class="item-img">
        \${item.image_url
          ? \`<img src="\${escHtml(item.image_url)}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\`
          : emojiFor(item.name)}
      </div>
      <div class="item-body">
        <div class="item-name">\${escHtml(item.name)}</div>
        <div class="item-meta">
          \${formatPrice(item.price_min, item.price_max)}
          \${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank" rel="noopener noreferrer">ссылка</a>\` : ''}
        </div>
      </div>
      <button class="btn-delete" data-delete="\${item.id}" title="Удалить">✕</button>
    </div>
  \`).join('');

  return \`
    <div class="header">🎁 Мой вишлист</div>
    <div class="add-form">
      <input id="inp-name" placeholder="Название подарка *" autocomplete="off">
      <input id="inp-link" placeholder="Ссылка (необязательно)" type="url">
      <input id="inp-price" placeholder="Цена: 50 или диапазон 50-100">
      <button class="btn-primary" id="btn-add">+ Добавить подарок</button>
    </div>
    <div class="stats-bar">
      \${state.items.length} подарков · <strong>\${state.claimedCount} уже выбраны 🎉</strong>
    </div>
    <div class="item-list">\${itemsHtml}</div>
    \${state.items.length === 0 ? '<div class="footer-note">Добавьте первый подарок 🎁</div>' : ''}
  \`;
}

function renderFriend() {
  const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(p => p));
  const visible = state.items.filter(i => i.price_min === null || i.price_min <= state.budget);
  const otherClaimedCount = state.claimedCount - state.myClaimedIds.size;

  const itemsHtml = visible.map(item => {
    const isMine = state.myClaimedIds.has(item.id);
    return \`
      <div class="item" data-id="\${item.id}">
        <div class="item-img">
          \${item.image_url
            ? \`<img src="\${escHtml(item.image_url)}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\`
            : emojiFor(item.name)}
        </div>
        <div class="item-body">
          <div class="item-name">\${escHtml(item.name)}</div>
          <div class="item-meta">
            \${formatPrice(item.price_min, item.price_max)}
            \${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank" rel="noopener noreferrer">ссылка</a>\` : ''}
          </div>
        </div>
        \${isMine
          ? \`<button class="btn-unclaim" data-unclaim="\${item.id}">Отменить ↩</button>\`
          : \`<button class="btn-claim" data-claim="\${item.id}">Подарю!</button>\`}
      </div>
    \`;
  }).join('');

  return \`
    <div class="header">🎁 Вишлист</div>
    <div class="budget-bar">
      <div class="budget-label">Мой бюджет</div>
      <div class="budget-row">
        <input type="range" id="budget-slider" min="0" max="\${maxPrice}" value="\${state.budget}">
        <input class="budget-num" type="number" id="budget-num" value="\${state.budget}">
        <span class="budget-unit">€</span>
      </div>
      <div class="budget-hint" id="budget-hint">Показано \${visible.length} из \${state.items.length} подарков</div>
    </div>
    <div class="item-list">\${itemsHtml}</div>
    \${otherClaimedCount > 0 ? \`<div class="footer-note">\${otherClaimedCount} подарков уже выбраны другими</div>\` : ''}
    \${visible.length === 0 ? '<div class="footer-note">Нет подарков в вашем бюджете</div>' : ''}
  \`;
}

function attachEvents() {
  // Owner: add item
  document.getElementById('btn-add')?.addEventListener('click', async () => {
    const name = document.getElementById('inp-name').value.trim();
    if (!name) { showToast('Введите название подарка'); return; }
    const link = document.getElementById('inp-link').value.trim();
    const price = document.getElementById('inp-price').value.trim();
    const res = await api('POST', '/api/items', { name, link: link || undefined, price: price || undefined });
    if (res.ok) {
      document.getElementById('inp-name').value = '';
      document.getElementById('inp-link').value = '';
      document.getElementById('inp-price').value = '';
      await loadItems();
    } else {
      const err = await res.json();
      showToast(err.error || 'Ошибка');
    }
  });

  // Owner: delete item
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete;
      const res = await api('DELETE', \`/api/items/\${id}\`);
      if (res.ok) await loadItems();
    });
  });

  // Friend: budget slider
  const slider = document.getElementById('budget-slider');
  const numInput = document.getElementById('budget-num');
  function updateBudget(val) {
    state.budget = Math.max(0, +val);
    if (slider) slider.value = state.budget;
    if (numInput) numInput.value = state.budget;
    const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(Boolean));
    const visible = state.items.filter(i => i.price_min === null || i.price_min <= state.budget);
    const hint = document.getElementById('budget-hint');
    if (hint) hint.textContent = \`Показано \${visible.length} из \${state.items.length} подарков\`;
    // Re-render item list only
    const list = document.querySelector('.item-list');
    if (list) {
      const otherClaimedCount = state.claimedCount - state.myClaimedIds.size;
      const itemsHtml = visible.map(item => {
        const isMine = state.myClaimedIds.has(item.id);
        return \`<div class="item" data-id="\${item.id}">
          <div class="item-img">\${item.image_url ? \`<img src="\${escHtml(item.image_url)}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\` : emojiFor(item.name)}</div>
          <div class="item-body"><div class="item-name">\${escHtml(item.name)}</div><div class="item-meta">\${formatPrice(item.price_min, item.price_max)}\${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank" rel="noopener noreferrer">ссылка</a>\` : ''}</div></div>
          \${isMine ? \`<button class="btn-unclaim" data-unclaim="\${item.id}">Отменить ↩</button>\` : \`<button class="btn-claim" data-claim="\${item.id}">Подарю!</button>\`}
        </div>\`;
      }).join('');
      list.innerHTML = itemsHtml;
      attachClaimEvents();
    }
  }
  slider?.addEventListener('input', () => updateBudget(slider.value));
  numInput?.addEventListener('input', () => updateBudget(numInput.value));

  attachClaimEvents();
}

function attachClaimEvents() {
  // Friend: claim
  document.querySelectorAll('[data-claim]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.claim;
      const res = await api('POST', \`/api/items/\${id}/claim\`);
      if (res.status === 409) {
        showToast('Кто-то успел раньше! Обновите список.');
        await loadItems();
      } else if (res.ok) {
        state.myClaimedIds.add(id);
        await loadItems();
      }
    });
  });

  // Friend: unclaim
  document.querySelectorAll('[data-unclaim]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.unclaim;
      const res = await api('DELETE', \`/api/items/\${id}/claim\`);
      if (res.ok) {
        state.myClaimedIds.delete(id);
        await loadItems();
      }
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadItems().catch(err => {
  document.getElementById('app').innerHTML = '<div class="loading">Ошибка загрузки. Попробуйте снова.</div>';
});
</script>
</body>
</html>`;
