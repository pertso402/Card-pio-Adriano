// ═══════════════════════════════════════════════════════════
//  ADRIANO LANCHES v2 — "Na Chapa"
//  Loja e produtos vêm do Supabase (realtime). Cada lanche é
//  desenhado pelo stack.js a partir dos ingredientes. Pedido é
//  criado via RPC criar_pedido (preço recalculado no banco).
// ═══════════════════════════════════════════════════════════
'use strict';

const supa = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
const $ = id => document.getElementById(id);
const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const short = v => 'R$ ' + (Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2).replace('.', ','));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const buzz = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Estado ─────────────────────────────────────────────────
const S = {
  loja: null, cats: [], prods: [], byId: new Map(),
  social: { pedidos_hoje: 0, top: [] },
  cart: store.get('adl2_cart', []),          // {key,id,qty,remove[],obs,origem}
  mode: (store.get('adl_cliente') || {}).mode || 'delivery',
  pay: (store.get('adl_cliente') || {}).pay || null,
  drinkAsked: 0, common: {}, hero: null,
};

// ── Produtos ───────────────────────────────────────────────
const catOf = p => S.cats.find(c => c.id === p.categoria_id);
const isDrink = p => !!p && catOf(p)?.slug === 'bebidas';
const isLanche = p => !!p && !isDrink(p);
const qtyOf = id => S.cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
const drinksInCart = () => S.cart.filter(l => isDrink(S.byId.get(l.id))).reduce((s, l) => s + l.qty, 0);
const lanchesInCart = () => S.cart.filter(l => isLanche(S.byId.get(l.id))).reduce((s, l) => s + l.qty, 0);
const findProd = re => S.prods.find(p => p.disponivel && re.test(p.nome));
const art = (p, opts) => Stack.svg(p.descricao || p.nome, opts);

function bevLook(p) {
  const n = p.nome.toLowerCase();
  let shape = 'lata';
  if (/\b2l\b/.test(n)) shape = 'pet2';
  else if (/600/.test(n)) shape = 'pet';
  else if (/ks|290|long/.test(n)) shape = 'ks';
  else if (/900|suco/.test(n)) shape = 'box';
  else if (/monster|energ/.test(n)) shape = 'tall';
  else if (/h2o|água|agua/.test(n)) shape = 'pet';
  const zero = /zero/.test(n);
  const look = [
    [/coca/, zero ? ['#1A1A1A', '#E41E2B', 'Coca Zero'] : ['#E41E2B', '#fff', 'Coca']],
    [/fanta/, ['#F7841E', '#fff', 'Fanta']],
    [/sprite/, ['#00A651', '#FFE14D', 'Sprite']],
    [/guaran/, zero ? ['#151515', '#3FBF5F', 'Guaraná Zero'] : ['#0B7A3B', '#FFD21F', 'Guaraná']],
    [/itub/, ['#F2C200', '#B3001B', 'Itubaína']],
    [/monster|energ/, zero ? ['#E6E6E6', '#111', 'Monster Zero'] : ['#111', '#7AC943', 'Monster']],
    [/h2o/, ['#BFE6F5', '#0E6E9C', 'H2O']],
    [/água|agua/, ['#CFEFFF', '#1F6E9A', 'Água']],
    [/prats/, ['#FF9A1F', '#fff', 'Prats']],
    [/festy/, ['#FFB300', '#7A2E00', 'Festy']],
  ].find(([re]) => re.test(n));
  const [c, c2, label] = look ? look[1] : ['#888', '#fff', p.nome.split(' ')[0]];
  return { shape, c, c2, label };
}
const canHTML = p => { const l = bevLook(p); return `<div class="can ${l.shape}" style="--c:${l.c};--c2:${l.c2}"><span>${esc(l.label)}</span></div>`; };
const thumb = p => isDrink(p) ? `<div style="transform:scale(.48);transform-origin:center bottom;display:flex;justify-content:center;height:100%;align-items:flex-end">${canHTML(p)}</div>`
  : p.foto_url ? `<img class="thumb-photo" src="${esc(p.foto_url)}" alt="" loading="lazy">` : art(p);

// ── Carregamento ───────────────────────────────────────────
async function loadMenu() {
  const { data: loja, error } = await supa.from('lojas').select('*').eq('slug', LOJA_SLUG).single();
  if (error || !loja) throw error || new Error('Loja não encontrada');
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supa.from('categorias').select('*').eq('loja_id', loja.id).order('ordem'),
    supa.from('produtos').select('*').eq('loja_id', loja.id).order('ordem'),
  ]);
  applyMenu(loja, cats || [], prods || []);
  store.set('adl2_menu', { loja, cats, prods });
}
function applyMenu(loja, cats, prods) {
  S.loja = loja;
  S.cats = cats.filter(c => c.ativa);
  S.prods = prods.map(p => ({ ...p, preco: Number(p.preco), ing: Stack.ingredientsOf(p.descricao) }));
  S.byId = new Map(S.prods.map(p => [p.id, p]));
  S.common = {};
  for (const c of S.cats) {
    const list = S.prods.filter(p => p.categoria_id === c.id);
    const freq = {};
    list.forEach(p => p.ing.forEach(i => freq[i] = (freq[i] || 0) + 1));
    S.common[c.id] = new Set(Object.keys(freq).filter(i => freq[i] >= list.length * .6));
  }
}
async function loadSocial() {
  const { data } = await supa.rpc('vitrine_social', { p_loja_slug: LOJA_SLUG });
  if (data) S.social = data;
}
let reloadT;
function subscribe() {
  const id = S.loja.id;
  const reload = () => { clearTimeout(reloadT); reloadT = setTimeout(async () => { await loadMenu(); syncCart(); renderAll(false); }, 300); };
  supa.channel('cardapio2-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos', filter: `loja_id=eq.${id}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias', filter: `loja_id=eq.${id}` }, reload)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lojas', filter: `id=eq.${id}` }, reload)
    .subscribe();
}

// ── Loja aberta? (espelha public.loja_aberta) ──────────────
function lojaStatus() {
  const l = S.loja; if (!l) return { open: false, text: '…' };
  const h = l.config?.horario || {};
  const toMin = t => { const [a, b] = (t || '00:00').split(':').map(Number); return a * 60 + b; };
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const m = now.getHours() * 60 + now.getMinutes(), abre = toMin(h.abre), fecha = toMin(h.fecha);
  const inHours = abre <= fecha ? (m >= abre && m < fecha) : (m >= abre || m < fecha);
  if (l.modo === 'aberta') return { open: true, text: 'aberto agora' };
  if (l.modo === 'fechada') return { open: false, text: 'fechado agora' };
  return inHours ? { open: true, text: `aberto até ${h.fecha}` } : { open: false, text: `abre às ${h.abre}` };
}

// ── Render geral ───────────────────────────────────────────
function renderStrip() {
  const fotos = S.prods.filter(p => p.foto_url && p.disponivel);
  $('strip').hidden = !fotos.length;
  $('stripTrack').innerHTML = [...fotos, ...fotos].map(p => `<button class="strip-item" onclick="openItem('${p.id}')"><img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy"><span>${esc(p.nome)}<b>${short(p.preco)}</b></span></button>`).join('');
}
function renderAll(withHero = true) {
  renderStatus(); renderStrip(); if (withHero) renderHero(); renderTabs(); renderMenu(); renderAgain(); updateTray();
}
function renderStatus() {
  const st = lojaStatus(), c = S.loja.config || {};
  $('statusText').textContent = st.text;
  $('status').classList.toggle('closed', !st.open);
  $('footAddr').textContent = c.endereco || '';
  $('footHours').textContent = `todos os dias · ${c.horario?.abre || '19:00'} às ${c.horario?.fecha || '01:00'}`;
  const painel = typeof PAINEL_URL !== 'undefined' ? PAINEL_URL : '';
  $('gear').hidden = !painel; if (painel) $('gear').href = painel;
}

// ── HERO: anatomia → prensa conforme rola ──────────────────
function pickHero() {
  const ok = p => isLanche(p) && p.disponivel;
  return S.prods.find(p => ok(p) && p.tags.includes('mais-pedido'))
    || (S.social.top || []).map(id => S.byId.get(id)).find(ok)
    || S.prods.filter(ok).sort((a, b) => b.ing.length - a.ing.length)[0];
}
const shortName = p => p.nome.replace(/^Especial\s+(com\s+)?/i, '');
function renderHero() {
  const p = pickHero(); if (!p) return;
  S.hero = p;
  $('heroName').textContent = shortName(p);
  $('heroPriceLabel').textContent = `um ${shortName(p)} sai por`;
  $('heroPrice').textContent = short(p.preco);
  $('heroStack').innerHTML = art(p, { labels: true });
  $('heroPhoto').innerHTML = p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nome)}"><span class="mono">foto real · saindo da chapa</span>` : '';
  $('heroBtn').onclick = () => openItem(p.id);
  $('heroBtn').textContent = 'Quero esse';
  heroScroll();
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
let heroTick = false;
function heroScroll() {
  const hero = $('hero'), stack = $('heroStack'), press = $('press'), stage = $('heroStage');
  if (!hero || !stack.firstElementChild) return;
  const total = hero.offsetHeight - innerHeight;
  const p = reduced ? 1 : clamp(-hero.getBoundingClientRect().top / total);
  // 1) camadas se juntam
  const join = ease(clamp(p / .5));
  stack.style.setProperty('--gap', (34 * (1 - join)).toFixed(2));
  stack.style.setProperty('--lbo', clamp(1 - p / .38).toFixed(2));
  // 2) sem as legendas, o lanche cresce e vai pro centro
  const svgEl = stack.firstElementChild;
  const sc = 1 + .38 * join, tx = (.5 - .32) * svgEl.clientWidth * join;
  // 3) a prensa desce, aperta e sobe
  const sr = stage.getBoundingClientRect();
  const layers = svgEl.querySelectorAll('.ly');
  const topBread = layers[layers.length - 1].getBoundingClientRect().top - sr.top;
  const down = clamp((p - .45) / .17), squeeze = clamp((p - .62) / .1), up = clamp((p - .8) / .12);
  const sq = Math.sin(squeeze * Math.PI) * 16;
  const hit = topBread - press.offsetHeight + 2, start = hit - 150;
  const y = start + (hit - start) * ease(down) + sq - 170 * ease(up);
  press.style.setProperty('--press-y', `${y.toFixed(1)}px`);
  press.style.opacity = Math.min(clamp(down * 4), 1 - up).toFixed(2);
  svgEl.style.transformOrigin = '32% 100%';
  svgEl.style.transform = `translateX(${tx.toFixed(1)}px) scale(${sc.toFixed(3)}, ${(sc * (1 - sq / 110)).toFixed(3)})`;
  stage.style.setProperty('--heat', clamp((p - .55) / .3).toFixed(2));
  $('steam').classList.toggle('on', p > .6);
  hero.classList.toggle('done', p > .7);
  hero.classList.toggle('reveal', p > .9 && !!S.hero?.foto_url);
  hero.classList.toggle('moving', p > .02);
}
addEventListener('scroll', () => {
  if (!heroTick) { heroTick = true; requestAnimationFrame(() => { heroScroll(); heroTick = false; }); }
  $('bar').classList.toggle('solid', scrollY > 30);
}, { passive: true });
addEventListener('resize', heroScroll);

// ── Abas + cardápio ────────────────────────────────────────
const catShort = c => ({ 'prensados-salsicha': 'Salsicha', 'lanches-hamburguer': 'Hambúrguer', bebidas: 'Geladas' }[c.slug] || c.nome);
function renderTabs() {
  $('tabs').innerHTML = `<div class="tabs-in">${S.cats.map((c, i) =>
    `<button class="tab ${i === 0 ? 'on' : ''}" data-cat="${c.id}" onclick="goCat('${c.id}')">${esc(catShort(c))}<sup>${S.prods.filter(p => p.categoria_id === c.id && p.disponivel).length}</sup></button>`).join('')}</div>`;
}
function goCat(id) {
  const el = document.getElementById('cat-' + id);
  if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' });
}
function stickers(p) {
  const top = new Set((S.social.top || []).slice(0, 3));
  if (top.has(p.id) || p.tags.includes('mais-pedido')) return '<span class="sticker red">mais pedido</span>';
  if (p.tags.includes('favorito')) return '<span class="sticker">favorito da casa</span>';
  if (p.tags.includes('monstro')) return '<span class="sticker">monstro</span>';
  if (p.tags.includes('premium')) return '<span class="sticker">premium</span>';
  if (p.tags.includes('veggie')) return '<span class="sticker veg">veggie</span>';
  return '';
}
function cardHTML(p, k, wide) {
  const common = S.common[p.categoria_id] || new Set();
  const ing = p.ing.filter(i => !/^p[aã]o$/.test(i)).map(i => common.has(i) ? esc(i) : `<b>${esc(i)}</b>`).join(', ');
  const q = qtyOf(p.id);
  return `<article class="card ${wide ? 'wide' : ''} ${p.disponivel ? '' : 'off'}" style="--k:${k}" onclick="openItem('${p.id}')">
    <div class="card-stage ${p.foto_url ? 'has-photo' : ''}">${stickers(p)}${p.foto_url ? `<img class="card-photo" src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy"><span class="xray" title="ver por dentro">${art(p)}</span>` : art(p)}</div>
    <div class="card-body">
      <h3 class="card-name">${esc(p.nome)}</h3>
      ${ing ? `<p class="card-ing">${ing}</p>` : ''}
      <div class="card-foot"><span class="price"><small>R$</small>${short(p.preco).replace('R$ ', '')}</span>
        <button class="plus ${q ? 'in' : ''}" data-id="${p.id}" aria-label="Adicionar ${esc(p.nome)}" onclick="event.stopPropagation();quickAdd('${p.id}')">${q ? q + 'x' : '+'}</button></div>
    </div>
  </article>`;
}
function renderMenu() {
  $('menu').innerHTML = S.cats.map(c => {
    const list = S.prods.filter(p => p.categoria_id === c.id);
    if (!list.length) return '';
    if (c.slug === 'bebidas') return renderFridge(c, list);
    const feat = list.filter(p => p.destaque && p.disponivel).sort((a, b) => (!!b.foto_url - !!a.foto_url) || b.ing.length - a.ing.length)[0];
    const rest = list.filter(p => p !== feat);
    return `<section class="cat" id="cat-${c.id}">
      <div class="cat-head"><h2>${esc(c.nome)}</h2><p>${list.length} na chapa</p></div>
      <div class="grid">${feat ? cardHTML(feat, 0, true) : ''}${rest.map((p, i) => cardHTML(p, i + 1, false)).join('')}</div>
    </section>`;
  }).join('');
  observeCats();
}
function shelfOf(p) {
  const s = bevLook(p).shape;
  if (s === 'lata') return 'Latinhas 350ml';
  if (s === 'ks') return 'Garrafinhas';
  if (s === 'pet') return /600/.test(p.nome) ? '600ml' : 'Águas';
  if (s === 'pet2') return '2 litros · pra galera';
  return 'Sucos & energéticos';
}
function bevHTML(p, origem = 'cardapio') {
  const q = qtyOf(p.id);
  return `<button class="bev" type="button" data-id="${p.id}" onclick="addDrink('${p.id}','${origem}')" aria-label="Adicionar ${esc(p.nome)}">
    ${q ? `<span class="bev-qty">${q}</span>` : ''}${canHTML(p)}
    <span class="bev-name">${esc(p.nome)}</span><span class="bev-price">${short(p.preco)}</span></button>`;
}
function renderFridge(c, list) {
  const order = ['Latinhas 350ml', 'Garrafinhas', '600ml', '2 litros · pra galera', 'Sucos & energéticos', 'Águas'];
  const groups = {};
  list.filter(p => p.disponivel).forEach(p => (groups[shelfOf(p)] ||= []).push(p));
  return `<section class="cat" id="cat-${c.id}">
    <div class="cat-head"><h2>Geladeira</h2><p>toca pra pegar</p></div>
    <div class="fridge">${order.filter(g => groups[g]).map(g => `<div class="shelf-label">${g}</div><div class="shelf">${groups[g].map(p => bevHTML(p)).join('')}</div>`).join('')}</div>
  </section>`;
}
let catObs;
function observeCats() {
  catObs?.disconnect();
  catObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id.replace('cat-', '');
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.cat === id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.cat').forEach(el => catObs.observe(el));
}
function refreshBadges() {
  document.querySelectorAll('.plus[data-id]').forEach(b => { const q = qtyOf(b.dataset.id); b.classList.toggle('in', q > 0); b.textContent = q ? q + 'x' : '+'; });
  document.querySelectorAll('.bev[data-id]').forEach(b => {
    const q = qtyOf(b.dataset.id); let badge = b.querySelector('.bev-qty');
    if (q && !badge) { badge = document.createElement('span'); badge.className = 'bev-qty'; b.prepend(badge); }
    if (badge) { if (q) badge.textContent = q; else badge.remove(); }
  });
}

// ── Cliente que volta ──────────────────────────────────────
function renderAgain() {
  const last = store.get('adl_ultimo'), cli = store.get('adl_cliente'), el = $('again');
  const itens = (last?.itens || []).filter(i => S.byId.get(i.id)?.disponivel);
  if (!itens.length || S.cart.length) { el.hidden = true; return; }
  const first = S.byId.get((itens.find(i => isLanche(S.byId.get(i.id))) || itens[0]).id);
  const nome = cli?.nome ? cli.nome.split(' ')[0] : '';
  el.innerHTML = `<div class="again-art">${thumb(first)}</div>
    <div class="again-txt"><b>${nome ? `E aí, ${esc(nome)}!` : 'De volta!'} Repete o de sempre?</b><span>${esc(itens.map(i => `${i.qty}x ${S.byId.get(i.id).nome}`).join(', '))}</span></div>
    <button class="btn cream" style="flex:0 0 auto;min-height:44px;font-size:.95rem" onclick="repeatLast()">Repetir</button>`;
  el.hidden = false;
}
function repeatLast() {
  (store.get('adl_ultimo')?.itens || []).forEach(i => { if (S.byId.get(i.id)?.disponivel) addLine({ id: i.id, qty: i.qty, remove: i.remove || [], obs: i.obs || '', origem: 'repetir' }); });
  buzz(); openReceipt();
}

// ── Carrinho ───────────────────────────────────────────────
const lineKey = l => `${l.id}|${[...(l.remove || [])].sort().join(',')}|${l.obs || ''}|${l.origem}`;
function addLine(line) {
  const l = { remove: [], obs: '', origem: 'cardapio', qty: 1, ...line };
  l.key = lineKey(l);
  const ex = S.cart.find(x => x.key === l.key);
  if (ex) ex.qty += l.qty; else S.cart.push(l);
  saveCart(true);
}
function saveCart(bump) { store.set('adl2_cart', S.cart); updateTray(bump); refreshBadges(); }
function syncCart() {
  const n = S.cart.length;
  S.cart = S.cart.filter(l => S.byId.get(l.id)?.disponivel);
  if (S.cart.length < n) toast('Um item acabou e saiu da comanda');
  saveCart();
}
const subtotal = () => S.cart.reduce((s, l) => s + (S.byId.get(l.id)?.preco || 0) * l.qty, 0);
const count = () => S.cart.reduce((s, l) => s + l.qty, 0);
function taxa() {
  if (S.mode !== 'delivery' || !S.cart.length) return 0;
  const c = S.loja?.config || {};
  if (c.frete_gratis_acima && subtotal() >= Number(c.frete_gratis_acima)) return 0;
  return Number(c.taxa_entrega || 0);
}
const total = () => subtotal() + taxa();
function freteFalta() {
  const g = Number(S.loja?.config?.frete_gratis_acima || 0);
  return g && S.mode === 'delivery' ? { meta: g, falta: Math.max(0, g - subtotal()) } : null;
}
function updateTray(bump) {
  const n = count(), f = freteFalta();
  $('barCount').textContent = n;
  $('trayCount').textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
  $('trayTotal').textContent = short(subtotal());
  $('trayLabel').textContent = f && n ? (f.falta > 0 ? `Faltam ${fmt(f.falta)} p/ frete grátis` : 'Frete grátis garantido') : 'Ver comanda';
  const lanches = S.cart.map(l => S.byId.get(l.id)).filter(isLanche).slice(-3);
  $('trayStacks').innerHTML = lanches.map(p => art(p)).join('');
  $('trayStacks').hidden = !lanches.length;
  $('tray').classList.toggle('show', n > 0 && !$('sheet').classList.contains('open'));
  if (bump && n) {
    const t = $('tray'); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
    const b = $('barCart'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
}
function quickAdd(id) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  addLine({ id, origem: 'cardapio' }); buzz(); afterAdd(p);
}
function addDrink(id, origem) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  if (/com ou sem g[aá]s/i.test(p.descricao || '')) return openWater(p, origem);
  addLine({ id, origem }); buzz();
  if ($('sheet').classList.contains('open')) refreshSheet(); else toast(`${p.nome} na comanda`);
}
function afterAdd(p) {
  if (isLanche(p) && drinksInCart() === 0 && S.drinkAsked < 2) { S.drinkAsked++; setTimeout(() => { if (!$('sheet').classList.contains('open')) openDrinks(p); }, 380); }
  else toast(`${p.nome} na comanda`);
}

// ── Sheet ──────────────────────────────────────────────────
let view = null;
function openSheet(render, { paper = false } = {}) {
  view = render;
  const sh = $('sheet');
  sh.classList.toggle('paper', paper);
  $('sheetBody').innerHTML = render();
  $('sheetBody').scrollTop = 0;
  if (!sh.classList.contains('open')) {
    sh.classList.add('open'); $('scrim').classList.add('open'); document.body.classList.add('lock');
    history.pushState({ sheet: 1 }, '');
  }
  updateTray();
}
function refreshSheet() { if (!view) return; const b = $('sheetBody'), y = b.scrollTop; b.innerHTML = view(); b.scrollTop = y; }
function closeSheet(fromPop = false) {
  const sh = $('sheet'); if (!sh.classList.contains('open')) return;
  sh.classList.remove('open'); $('scrim').classList.remove('open'); document.body.classList.remove('lock');
  view = null; stopTrack();
  if (!fromPop && history.state?.sheet) history.back();
  setTimeout(updateTray, 200);
}
addEventListener('popstate', () => closeSheet(true));
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('scrim').onclick = () => closeSheet();
$('tray').onclick = () => openReceipt();
$('barCart').onclick = () => openReceipt();

// ── Montar o lanche ────────────────────────────────────────
let IT = null;
function openItem(id) {
  const p = S.byId.get(id); if (!p) return;
  if (isDrink(p)) return addDrink(id, 'cardapio');
  IT = { id, remove: new Set(), turbo: false, qty: 1, obs: '', obsOpen: false, show: p.foto_url ? 'photo' : 'inside', anim: 'build', hl: [] };
  openSheet(itemView);
}
const itShown = () => { const p = S.byId.get(IT.id), up = p.upgrade_para && S.byId.get(p.upgrade_para); return IT.turbo && up?.disponivel ? up : p; };
function itemView() {
  const p = S.byId.get(IT.id), up = p.upgrade_para && S.byId.get(p.upgrade_para), upOk = up?.disponivel, shown = itShown();
  const extra = upOk ? up.ing.filter(i => !p.ing.includes(i)) : [];
  const stackOpts = { removed: [...IT.remove], highlight: IT.hl };
  let stage = art(shown, stackOpts);
  if (IT.anim === 'build') stage = stage.replace('class="stack', 'class="stack build');
  IT.anim = 'none'; IT.hl = [];
  const photo = IT.show === 'photo' && shown.foto_url;
  return `
    <div class="it-stage" id="itStage">
      <button class="it-close" onclick="closeSheet()" aria-label="Fechar">✕</button>
      ${shown.foto_url ? `<div class="it-view"><button class="${photo ? 'on' : ''}" onclick="itShow('photo')">foto</button><button class="${photo ? '' : 'on'}" onclick="itShow('inside')">por dentro</button></div>` : ''}
      <div class="press"><span></span></div>
      ${photo ? `<img class="photo" src="${esc(shown.foto_url)}" alt="${esc(shown.nome)}">` : stage}
    </div>
    <div class="it-head"><h2 class="it-name">${esc(shown.nome)}</h2><span class="it-price">${short(shown.preco)}</span></div>
    ${shown.ing.length ? `<div class="it-sec"><p class="it-label">toque pra tirar</p><div class="chips">${shown.ing.map(i => {
      const k = Stack.keyOf(i) || 'pao', fixed = k === 'pao';
      return `<button class="chip ${fixed ? 'fixed' : ''} ${IT.remove.has(i) ? 'off' : ''}" style="--c:${Stack.COLOR[k] || '#888'}" onclick="toggleIng(this.dataset.i)" data-i="${esc(i)}"><i></i>${esc(i)}</button>`;
    }).join('')}</div></div>` : ''}
    ${upOk ? `<button class="turbo ${IT.turbo ? 'on' : ''}" onclick="toggleTurbo()">
      <span class="turbo-ico">⚡</span>
      <span class="turbo-txt"><small>turbina por + ${fmt(up.preco - p.preco)}</small><b>Vira ${esc(up.nome)}</b><span>${extra.length ? 'ganha ' + extra.map(e => '+ ' + esc(e)).join(', ') : 'versão mais caprichada'}</span></span>
      <span class="sw"></span></button>` : ''}
    ${IT.obsOpen
      ? `<div class="it-sec" style="margin-top:16px"><textarea class="field" id="itObs" maxlength="140" placeholder="Ex.: bem passado, molho à parte…" oninput="IT.obs=this.value">${esc(IT.obs)}</textarea></div>`
      : `<button class="obs-link" onclick="IT.obsOpen=true;refreshSheet();setTimeout(()=>$('itObs')?.focus(),60)">+ alguma observação?</button>`}
    <div class="foot-bar">
      <div class="qty"><button onclick="itQty(-1)" aria-label="Menos">−</button><span>${IT.qty}</span><button onclick="itQty(1)" aria-label="Mais">+</button></div>
      <button class="btn" id="itBtn" onclick="itConfirm()"><span>Prensar e pedir</span><span>${short(shown.preco * IT.qty)}</span></button>
    </div>`;
}
function itShow(v) { IT.show = v; IT.anim = v === 'inside' ? 'build' : 'none'; refreshSheet(); }
async function animateOut(ings) {
  const stage = $('itStage'); if (!stage) return;
  let hit = false;
  ings.forEach(i => stage.querySelectorAll(`.ly[data-ing="${CSS.escape(i)}"]`).forEach(g => { g.classList.add('out'); hit = true; }));
  if (hit) await wait(260);
}
async function toggleIng(i) {
  buzz();
  if (IT.show === 'photo') { IT.show = 'inside'; IT.anim = 'none'; }
  if (IT.remove.has(i)) { IT.remove.delete(i); IT.hl = [i]; }
  else { IT.remove.add(i); if (IT.show === 'inside') await animateOut([i]); }
  refreshSheet();
}
async function toggleTurbo() {
  const p = S.byId.get(IT.id), up = S.byId.get(p.upgrade_para);
  const extra = up.ing.filter(i => !p.ing.includes(i));
  buzz(15);
  if (IT.show === 'photo') { IT.show = 'inside'; IT.anim = 'none'; }
  if (!IT.turbo) { IT.turbo = true; IT.hl = extra; }
  else { if (IT.show === 'inside') await animateOut(extra); IT.turbo = false; }
  refreshSheet();
}
function itQty(d) { IT.qty = Math.max(1, Math.min(20, IT.qty + d)); refreshSheet(); }
async function itConfirm() {
  const p = S.byId.get(IT.id), shown = itShown();
  const btn = $('itBtn'); btn.disabled = true;
  // prensa desce, lanche amassa, vapor
  const stage = $('itStage'), svg = stage.querySelector('svg.stack');
  if (svg && !reduced) {
    const layers = svg.querySelectorAll('.ly');
    const top = layers[layers.length - 1].getBoundingClientRect().top - stage.getBoundingClientRect().top;
    stage.style.setProperty('--hit', `${Math.max(0, top - stage.querySelector('.press').offsetHeight + 6)}px`);
    stage.classList.add('pressing'); buzz(30);
    await wait(720);
  }
  addLine({ id: shown.id, qty: IT.qty, remove: [...IT.remove].filter(i => shown.ing.includes(i)), obs: (IT.obs || '').trim(), origem: shown === p ? 'cardapio' : 'upgrade' });
  if (drinksInCart() === 0 && S.drinkAsked < 2) { S.drinkAsked++; openDrinks(shown); }
  else { closeSheet(); toast(`${shown.nome} na comanda`); }
}

// ── Upsell de bebida ───────────────────────────────────────
function upsellDrinks() {
  return [/^coca-cola lata/i, /^guaraná antarctica lata/i, /^coca-cola zero lata/i, /^fanta lata/i, /^sprite lata/i, /^água/i].map(findProd).filter(Boolean);
}
function familyDeal() {
  const n = lanchesInCart(), big = findProd(/^coca-cola 2l/i), lata = findProd(/^coca-cola lata/i);
  if (n < 2 || !big || !lata || S.cart.some(l => /2l/i.test(S.byId.get(l.id)?.nome || ''))) return null;
  return { big, n, save: n * lata.preco - big.preco };
}
function openDrinks(p) {
  openSheet(() => {
    const deal = familyDeal(), has = drinksInCart();
    return `<div class="up-head"><small>✓ ${p ? esc(p.nome) + ' na comanda' : 'na comanda'}</small>
        <h3>E pra molhar<br>a goela?</h3><p>Prensado pede gelada. Toca pra levar junto.</p></div>
      <div class="fridge up-fridge"><div class="shelf">${upsellDrinks().map(d => bevHTML(d, 'upsell')).join('')}</div></div>
      ${deal ? `<button class="deal" onclick="addDrink('${deal.big.id}','upsell')"><span class="deal-txt"><b>Pra galera: ${esc(deal.big.nome)}</b>${deal.save > 0 ? `sai mais em conta que ${deal.n} latas, <em>economiza ${fmt(deal.save)}</em>` : `dá pra todo mundo por ${fmt(deal.big.preco)}`}</span><span class="deal-add">+ ${short(deal.big.preco)}</span></button>` : ''}
      <div class="actions">
        ${has ? `<button class="btn" onclick="openReceipt()"><span>Ver comanda</span><span>${short(subtotal())}</span></button>` : ''}
        <button class="btn ${has ? 'cream' : 'ghost'} center" onclick="closeSheet()">${has ? 'Voltar pro cardápio' : 'Tô de boa, sem bebida'}</button>
      </div>`;
  });
}
function openWater(p, origem) {
  openSheet(() => `<div class="up-head"><small>${esc(p.nome)}</small><h3>Com ou<br>sem gás?</h3></div>
    <div class="actions">
      <button class="btn center" onclick="addLine({id:'${p.id}',obs:'Sem gás',origem:'${origem}'});buzz();toast('Água na comanda');closeSheet()">Sem gás</button>
      <button class="btn cream center" onclick="addLine({id:'${p.id}',obs:'Com gás',origem:'${origem}'});buzz();toast('Água na comanda');closeSheet()">Com gás</button>
    </div>`);
}

// ── Comanda ────────────────────────────────────────────────
const lineObs = l => [l.remove?.length ? 'SEM ' + l.remove.join(', ') : '', l.obs].filter(Boolean).join(' · ');
function suggestions() {
  const out = [];
  if (drinksInCart() === 0) {
    const d = upsellDrinks().slice(0, 4);
    if (d.length) out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Faltou a gelada</b>Um toque e vai junto.</div>
      <div class="rc-mini">${d.map(x => `<button onclick="addLine({id:'${x.id}',origem:'bump'});buzz();refreshSheet()">${esc(bevLook(x).label)} lata · ${short(x.preco)}</button>`).join('')}</div></div>`);
  }
  const cand = S.cart.find(l => { const p = S.byId.get(l.id), u = p?.upgrade_para && S.byId.get(p.upgrade_para); return l.origem !== 'upgrade' && isLanche(p) && u?.disponivel; });
  if (cand) {
    const p = S.byId.get(cand.id), u = S.byId.get(p.upgrade_para), extra = u.ing.filter(i => !p.ing.includes(i));
    out.push(`<div class="rc-sug"><div class="rc-sug-art">${art(u)}</div><div class="rc-sug-txt"><b>Turbina o ${esc(p.nome)}?</b>Vira ${esc(u.nome)}${extra.length ? ' (+ ' + esc(extra.join(', ')) + ')' : ''} por + ${fmt(u.preco - p.preco)}${cand.qty > 1 ? ' cada' : ''}.</div>
      <button class="rc-sug-btn" onclick="upgradeLine('${cand.key}')">⚡ Turbinar</button></div>`);
  }
  const deal = familyDeal();
  if (deal && drinksInCart() > 0 && out.length < 2) out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Pra galera</b>${esc(deal.big.nome)} por ${fmt(deal.big.preco)}.</div><button class="rc-sug-btn" onclick="addLine({id:'${deal.big.id}',origem:'bump'});buzz();refreshSheet()">+ Levar</button></div>`);
  return out.slice(0, 2).join('');
}
function upgradeLine(key) {
  const l = S.cart.find(x => x.key === key); if (!l) return;
  const p = S.byId.get(l.id), u = S.byId.get(p.upgrade_para);
  S.cart = S.cart.filter(x => x !== l);
  addLine({ id: u.id, qty: l.qty, remove: (l.remove || []).filter(i => u.ing.includes(i)), obs: l.obs, origem: 'upgrade' });
  buzz(15); toast(`Turbinado: ${u.nome}`); refreshSheet();
}
function changeLine(key, d) {
  const l = S.cart.find(x => x.key === key); if (!l) return;
  l.qty += d;
  if (l.qty <= 0) S.cart = S.cart.filter(x => x !== l);
  saveCart(); buzz();
  if (!S.cart.length) closeSheet(); else refreshSheet();
}
function setMode(m) { S.mode = m; buzz(); refreshSheet(); updateTray(); }
function freteHTML() {
  const f = freteFalta(); if (!f) return '';
  return `<div class="frete"><div class="frete-txt">${f.falta > 0 ? `Faltam <b>${fmt(f.falta)}</b> pro frete grátis` : 'Você ganhou <b>frete grátis</b>!'}</div><div class="frete-bar"><i style="width:${Math.min(100, subtotal() / f.meta * 100)}%"></i></div></div>`;
}
function openReceipt() { openSheet(receiptView, { paper: true }); }
function receiptView() {
  const c = S.loja.config || {};
  if (!S.cart.length) return `<div class="receipt"><div class="empty"><b>Comanda vazia</b><p>Bora escolher um prensado?</p></div></div><div class="actions"><button class="btn center" onclick="closeSheet()">Ver cardápio</button></div>`;
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const tx = taxa();
  return `<div class="receipt">
      <div class="rc-head"><b>Comanda</b><span>ADRIANO LANCHES · ${now}</span></div>
      ${S.cart.map(l => { const p = S.byId.get(l.id); if (!p) return ''; const o = lineObs(l);
        return `<div class="rc-item"><div class="rc-art">${thumb(p)}</div>
          <div class="rc-name">${l.qty}x ${esc(p.nome)}</div><div class="rc-price">${fmt(p.preco * l.qty)}</div>
          ${o ? `<div class="rc-obs">${esc(o)}</div>` : ''}
          <div class="rc-ctrl"><button onclick="changeLine('${l.key}',-1)" aria-label="Menos">−</button><span>${l.qty}</span><button onclick="changeLine('${l.key}',1)" aria-label="Mais">+</button><span class="unit">${fmt(p.preco)} un.</span></div></div>`; }).join('')}
      ${suggestions()}${freteHTML()}
      <div class="modes">
        <button class="seg ${S.mode === 'delivery' ? 'on' : ''}" onclick="setMode('delivery')">Entrega<small>${esc(c.tempo_entrega || '')} · ${c.taxa_entrega ? short(c.taxa_entrega) : 'grátis'}</small></button>
        <button class="seg ${S.mode === 'retirada' ? 'on' : ''}" onclick="setMode('retirada')">Retirada<small>${esc(c.tempo_retirada || '')} · sem taxa</small></button>
      </div>
      <div class="rc-totals">
        <div class="rc-row"><span>Subtotal</span><span>${fmt(subtotal())}</span></div>
        <div class="rc-row"><span>${S.mode === 'delivery' ? 'Entrega' : 'Retirada no balcão'}</span><span class="${tx ? '' : 'free'}">${tx ? fmt(tx) : 'grátis'}</span></div>
        <div class="rc-row total"><span>TOTAL</span><span>${fmt(total())}</span></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" onclick="openCheckout()"><span>Fechar pedido</span><span>→</span></button>
      <button class="btn ghost center" onclick="closeSheet()">Continuar escolhendo</button>
    </div>`;
}

// ── Checkout ───────────────────────────────────────────────
function maskTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}
function openCheckout() { openSheet(checkoutView); }
function checkoutView() {
  const cli = store.get('adl_cliente') || {}, st = lojaStatus(), c = S.loja.config || {};
  const formas = c.formas_pagamento || ['pix', 'dinheiro', 'cartao'];
  const label = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão' };
  const pixNote = c.chave_pix ? 'Depois de confirmar, aparece o QR Code e o copia e cola com o valor certinho.' : 'Paga no PIX na hora da entrega ou da retirada.';
  return `<div class="co dark">
      <button class="co-back" onclick="openReceipt()">← voltar pra comanda</button>
      <h3>Quase lá.<br>Só falta isso.</h3>
      ${st.open ? '' : `<div class="closed">A loja está ${esc(st.text)}. Sua comanda fica salva até abrir.</div>`}
      <div class="co-sec"><span class="co-label">quem tá pedindo</span>
        <input class="field" id="coNome" autocomplete="name" placeholder="Seu nome" value="${esc(cli.nome || '')}">
        <input class="field" id="coTel" type="tel" inputmode="numeric" autocomplete="tel" placeholder="WhatsApp com DDD" value="${esc(cli.tel || '')}" oninput="this.value=maskTel(this.value)"></div>
      <div class="co-sec"><span class="co-label">como recebe</span>
        <div class="modes" style="margin:0">
          <button class="seg ${S.mode === 'delivery' ? 'on' : ''}" onclick="keepForm();setMode('delivery')">Entrega<small>+ ${short(c.taxa_entrega || 0)}</small></button>
          <button class="seg ${S.mode === 'retirada' ? 'on' : ''}" onclick="keepForm();setMode('retirada')">Retirada<small>sem taxa</small></button>
        </div>
        ${S.mode === 'delivery' ? `<div class="co-grid"><input class="field" id="coRua" autocomplete="address-line1" placeholder="Rua / Avenida" value="${esc(cli.rua || '')}"><input class="field" id="coNum" inputmode="numeric" placeholder="Nº" value="${esc(cli.numero || '')}"></div>
          <input class="field" id="coBairro" placeholder="Bairro" value="${esc(cli.bairro || '')}">
          <input class="field" id="coComp" placeholder="Complemento / referência" value="${esc(cli.comp || '')}">`
        : `<div class="note">Retire em <b>${esc(c.endereco || '')}</b></div>`}</div>
      <div class="co-sec"><span class="co-label">pagamento</span>
        <div class="pays">${formas.map(f => `<button class="seg ${S.pay === f ? 'on' : ''}" onclick="keepForm();S.pay='${f}';refreshSheet()">${label[f]}</button>`).join('')}</div>
        ${S.pay === 'dinheiro' ? `<input class="field" id="coTroco" inputmode="decimal" placeholder="Troco pra quanto? (opcional)" value="${esc(cli.troco || '')}">` : ''}
        ${S.pay === 'pix' ? `<div class="note">${pixNote}</div>` : ''}
        ${S.pay === 'cartao' ? `<div class="note">A maquininha vai até você (ou fica no balcão).</div>` : ''}</div>
      <div class="co-sec"><span class="co-label">observação do pedido</span>
        <textarea class="field" id="coObs" maxlength="300" placeholder="Opcional">${esc(cli.obsPedido || '')}</textarea></div>
      <div class="co-sum">
        <div class="rc-row"><span>${count()} ${count() === 1 ? 'item' : 'itens'}</span><span>${fmt(subtotal())}</span></div>
        <div class="rc-row"><span>${S.mode === 'delivery' ? 'Entrega' : 'Retirada'}</span><span class="${taxa() ? '' : 'free'}">${taxa() ? fmt(taxa()) : 'grátis'}</span></div>
        <div class="rc-row total"><span>TOTAL</span><span>${fmt(total())}</span></div>
      </div>
      <p class="err" id="coErr"></p>
    </div>
    <div class="foot-bar"><button class="btn" id="coBtn" onclick="placeOrder()" ${st.open ? '' : 'disabled'}><span>${st.open ? 'Mandar pra chapa' : 'Loja fechada'}</span><span>${short(total())}</span></button></div>`;
}
function keepForm() {
  const cli = { ...(store.get('adl_cliente') || {}) };
  [['nome', 'coNome'], ['tel', 'coTel'], ['rua', 'coRua'], ['numero', 'coNum'], ['bairro', 'coBairro'], ['comp', 'coComp'], ['troco', 'coTroco'], ['obsPedido', 'coObs']]
    .forEach(([k, id]) => { const el = $(id); if (el) cli[k] = el.value; });
  store.set('adl_cliente', cli);
}
async function placeOrder() {
  keepForm();
  const cli = store.get('adl_cliente') || {};
  const err = m => { $('coErr').textContent = m; $('coErr').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  if (!cli.nome?.trim()) return err('Coloca seu nome.');
  if ((cli.tel || '').replace(/\D/g, '').length < 10) return err('WhatsApp com DDD, por favor.');
  if (S.mode === 'delivery' && (!cli.rua?.trim() || !cli.numero?.trim() || !cli.bairro?.trim())) return err('Falta rua, número ou bairro.');
  if (!S.pay) return err('Escolhe como vai pagar.');
  const btn = $('coBtn'); btn.disabled = true; btn.firstElementChild.textContent = 'Enviando…';
  const pedido = {
    cliente_nome: cli.nome.trim(), cliente_telefone: cli.tel, tipo_entrega: S.mode, forma_pagamento: S.pay,
    endereco: S.mode === 'delivery' ? { rua: cli.rua, numero: cli.numero, bairro: cli.bairro, complemento: cli.comp || null } : null,
    troco_para: S.pay === 'dinheiro' && cli.troco ? String(cli.troco).replace(',', '.').replace(/[^\d.]/g, '') : null,
    observacoes: cli.obsPedido || null,
  };
  const itens = S.cart.map(l => ({ produto_id: l.id, quantidade: l.qty, observacao: lineObs(l) || null, origem: l.origem }));
  const { data, error } = await supa.rpc('criar_pedido', { p_loja_slug: LOJA_SLUG, p_pedido: pedido, p_itens: itens });
  if (error) { btn.disabled = false; btn.firstElementChild.textContent = 'Mandar pra chapa'; return err(error.message || 'Não deu pra enviar. Tenta de novo?'); }
  store.set('adl_cliente', { ...cli, mode: S.mode, pay: S.pay, obsPedido: '' });
  store.set('adl_ultimo', { at: Date.now(), itens: S.cart.map(l => ({ id: l.id, qty: l.qty, remove: l.remove, obs: l.obs })), total: data.total });
  store.set('adl_pedido', { token: data.token, numero: data.numero, at: Date.now() });
  S.cart = []; S.drinkAsked = 0; saveCart(); renderAgain();
  openTrack(data.token, data.numero, true);
  loadSocial();
}

// ── Acompanhamento + PIX ───────────────────────────────────
let trackT = null, TD = null, trackToken = null;
function stopTrack() { clearInterval(trackT); trackT = null; }
function openTrack(token, numero, fresh = false) {
  trackToken = token;
  TD = { numero, status: 'novo', tipo_entrega: S.mode, forma_pagamento: S.pay, itens: [], fresh };
  openSheet(trackView);
  const poll = async () => {
    const { data } = await supa.rpc('status_pedido', { p_token: token });
    if (data) { TD = { ...data, fresh: TD.fresh }; refreshSheet(); renderLive(); }
  };
  poll(); stopTrack(); trackT = setInterval(poll, 8000);
}
function pixHTML() {
  if (TD.forma_pagamento !== 'pix' || TD.status === 'cancelado') return '';
  const c = S.loja.config || {};
  if (TD.pago) return `<div class="pix"><h4>PIX recebido</h4><span class="pix-ok">✓ Pagamento confirmado pela loja</span></div>`;
  if (!c.chave_pix) return `<div class="pix"><h4>Pagamento no PIX</h4><p>Você paga na entrega ou na retirada. O valor é ${fmt(TD.total || 0)}.</p></div>`;
  const code = Pix.code({ key: c.chave_pix, name: S.loja.nome, city: (c.endereco || '').split(',').pop().split('/')[0] || 'Umuarama', amount: TD.total, txid: 'PED' + TD.numero });
  return `<div class="pix"><h4>Paga no PIX agora</h4><p>Escaneia ou copia o código. O valor já vem certinho.</p>
    <div class="pix-qr">${Pix.qrSVG(code)}</div><div class="pix-val">${fmt(TD.total || 0)}</div>
    <button class="btn cream center" onclick="copyPix(this)" data-code="${esc(code)}">Copiar código PIX</button>
    <div class="pix-code">${esc(code)}</div>
    ${TD.pix_informado ? '<span class="pix-ok pix-wait">Avisamos a loja. Ela confere e confirma aqui.</span>'
      : `<button class="btn center" style="margin-top:10px;width:100%" onclick="informarPix(this)">Já paguei</button>`}</div>`;
}
async function copyPix(btn) {
  const code = btn.dataset.code;
  try { await navigator.clipboard.writeText(code); }
  catch { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  btn.textContent = 'Copiado ✓'; buzz(); setTimeout(() => { btn.textContent = 'Copiar código PIX'; }, 2200);
}
async function informarPix(btn) {
  btn.disabled = true;
  await supa.rpc('informar_pix', { p_token: trackToken });
  TD.pix_informado = true; refreshSheet();
}
function trackView() {
  const d = TD, ret = d.tipo_entrega === 'retirada';
  const steps = [['🧾', 'Pedido recebido'], ['🔥', 'Na chapa'], [ret ? '🛎️' : '🛵', ret ? 'Pronto pra retirar' : 'Saiu pra entrega'], ['✓', ret ? 'Retirado' : 'Entregue']];
  const cur = { novo: 0, preparo: 1, pronto: 2, entrega: 2, finalizado: 3 }[d.status] ?? 0;
  const num = '#' + String(d.numero).padStart(3, '0');
  if (d.status === 'cancelado') return `<div class="track"><div class="stamp" style="border-color:var(--muted);color:var(--muted)">Cancelado<small>${num}</small></div><p>A loja cancelou esse pedido. Chama no WhatsApp se tiver dúvida.</p><div class="actions"><button class="btn center" onclick="clearActive();closeSheet()">Fechar</button></div></div>`;
  return `<div class="track">
    <div class="stamp" ${d.fresh ? '' : 'style="animation:none"'}>${cur >= 3 ? 'Entregue' : 'Recebido'}<small>pedido ${num}</small></div>
    <p>${cur >= 3 ? 'Valeu demais. Bom apetite!' : 'Pode fechar: o status aparece aqui em cima.'}</p>
    ${pixHTML()}
    <ol class="steps">${steps.map(([ico, txt], i) => `<li class="${i < cur || cur === 3 ? 'done' : i === cur ? 'now' : ''}"><i>${i < cur || cur === 3 ? '✓' : ico}</i>${txt}</li>`).join('')}</ol>
    ${d.itens?.length ? `<div class="track-items">${d.itens.map(i => `${i.qtd}x ${esc(i.nome)}`).join('<br>')}<br><b>total ${fmt(d.total)}</b></div>` : ''}
    <div class="actions"><button class="btn ${cur >= 3 ? '' : 'cream'} center" onclick="${cur >= 3 ? 'clearActive();' : ''}closeSheet()">${cur >= 3 ? 'Fechar' : 'Voltar pro cardápio'}</button></div>
  </div>`;
}
function clearActive() { store.del('adl_pedido'); renderLive(); }
function renderLive() {
  const a = store.get('adl_pedido'), el = $('live');
  const old = a && Date.now() - a.at > 6 * 3600e3;
  if (old) store.del('adl_pedido');
  if (!a || old || (TD && TD.numero === a.numero && ['finalizado', 'cancelado'].includes(TD.status))) { el.hidden = true; return; }
  const st = TD?.numero === a.numero ? TD.status : 'novo';
  const label = { novo: 'recebido', preparo: 'na chapa', pronto: 'pronto!', entrega: 'saiu pra entrega' }[st];
  const pix = TD?.numero === a.numero && TD.forma_pagamento === 'pix' && !TD.pago && S.loja?.config?.chave_pix && !TD.pix_informado ? ' · pagar PIX' : '';
  el.innerHTML = `<i></i>Pedido #${String(a.numero).padStart(3, '0')} · ${label}${pix}`;
  el.hidden = false;
  el.onclick = () => openTrack(a.token, a.numero);
}
async function checkActive() {
  const a = store.get('adl_pedido'); if (!a) return;
  const { data } = await supa.rpc('status_pedido', { p_token: a.token });
  if (!data) { store.del('adl_pedido'); return; }
  TD = data; renderLive();
  if (!['finalizado', 'cancelado'].includes(data.status)) setTimeout(checkActive, 20000);
}

// ── Toast ──────────────────────────────────────────────────
let toastT;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

// ── Início ─────────────────────────────────────────────────
(async function init() {
  const cache = store.get('adl2_menu');
  if (cache?.loja) { applyMenu(cache.loja, cache.cats || [], cache.prods || []); syncCart(); renderAll(); }
  try {
    await Promise.all([loadMenu(), loadSocial()]);
    syncCart(); renderAll(); subscribe(); checkActive();
    setInterval(renderStatus, 60000);
  } catch (e) {
    console.error(e);
    if (!cache) $('menu').innerHTML = '<div class="empty" style="padding:60px 16px"><b>Sem conexão</b><p>Recarrega em alguns segundos.</p></div>';
  }
})();

Object.assign(window, {
  openItem, quickAdd, addDrink, goCat, repeatLast, closeSheet, refreshSheet, itShow, toggleIng, toggleTurbo, itQty, itConfirm,
  openReceipt, openCheckout, changeLine, upgradeLine, setMode, keepForm, placeOrder, maskTel, addLine, buzz, toast,
  copyPix, informarPix, clearActive,
});
