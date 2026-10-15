// ═══════════════════════════════════════════════════════════
//  ADRIANO LANCHES — cardápio "A Comanda"
//  Produtos e loja vêm do Supabase (realtime). Pedido é criado
//  via RPC criar_pedido, que recalcula preços no banco.
// ═══════════════════════════════════════════════════════════
'use strict';

const supa = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
const $ = id => document.getElementById(id);
const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const fmtShort = v => Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2).replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch {} };

// ── Estado ─────────────────────────────────────────────────
const S = {
  loja: null, cats: [], prods: [], byId: new Map(),
  social: { pedidos_hoje: 0, top: [] },
  cart: store.get('adl_cart', []),     // {key,id,qty,remove[],obs,origem}
  mode: (store.get('adl_cliente') || {}).mode || 'delivery',
  pay: (store.get('adl_cliente') || {}).pay || null,
  drinkAsked: 0,
  common: {},                          // ingredientes comuns por categoria
};

// ── Helpers de produto ─────────────────────────────────────
function ingredientes(desc) {
  if (!desc) return [];
  return desc.replace(/\.\s*$/, '').split(/,\s*|\s+e\s+/).map(s => s.trim().toLowerCase()).filter(Boolean);
}
const catOf = p => S.cats.find(c => c.id === p.categoria_id);
const isDrink = p => (catOf(p)?.slug || '').startsWith('bebidas');
const isLanche = p => p && !isDrink(p) && catOf(p)?.slug !== 'molhos';
const isAlcohol = p => catOf(p)?.slug === 'bebidas-alcoolicas';
const drinksInCart = () => S.cart.filter(l => isDrink(S.byId.get(l.id) || {})).reduce((s, l) => s + l.qty, 0);
const lanchesInCart = () => S.cart.filter(l => isLanche(S.byId.get(l.id))).reduce((s, l) => s + l.qty, 0);
const findProd = re => S.prods.find(p => p.disponivel && re.test(p.nome));

function bevLook(p) {
  const n = p.nome.toLowerCase();
  let shape = 'lata';
  if (/\b2l\b/.test(n)) shape = 'pet2';
  else if (/600/.test(n)) shape = 'pet';
  else if (/ks|290|long|355/.test(n)) shape = 'ks';
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
    [/suco/, ['#FF9A1F', '#fff', 'Suco']],
    [/heineken/, ['#0B6E3B', '#fff', 'Heineken']],
    [/stella/, ['#EFE6D2', '#C8102E', 'Stella']],
    [/budweiser/, ['#C8102E', '#fff', 'Budweiser']],
    [/\bsol\b/, ['#F2C200', '#1B4D9C', 'Sol']],
    [/brahma/, ['#C8102E', '#fff', 'Brahma']],
    [/skol/, ['#FFD100', '#C8102E', 'Skol']],
    [/antarctica boa/, ['#1C4FA0', '#fff', 'Antarctica']],
    [/festy/, ['#FFB300', '#7A2E00', 'Festy']],
  ].find(([re]) => re.test(n));
  const [c, c2, label] = look ? look[1] : ['#888', '#fff', p.nome.split(' ')[0]];
  return { shape, c, c2, label };
}
function canHTML(p) {
  const l = bevLook(p);
  return `<div class="can ${l.shape}" style="--c:${l.c};--c2:${l.c2}"><span>${esc(l.label)}</span></div>`;
}

// Arte de linha (mesmo traço da logo) para lanches sem foto
function art(w = 150) {
  return `<svg width="${w}" viewBox="0 0 120 100" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 46 Q14 12 60 12 Q106 12 106 46 Z"/>
    <g fill="#fff" stroke="none"><circle cx="44" cy="25" r="3"/><circle cx="60" cy="21" r="3"/><circle cx="76" cy="25" r="3"/><circle cx="52" cy="33" r="3"/><circle cx="68" cy="33" r="3"/></g>
    <path d="M10 58 q7 -8 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0"/>
    <path d="M16 70 H104 M80 70 v12 q0 5 5 5 q5 0 5 -5 v-12"/>
    <path d="M16 82 V90 H70"/>
  </svg>`;
}

// ── Carregamento ───────────────────────────────────────────
async function loadMenu() {
  const { data: loja, error } = await supa.from('lojas').select('*').eq('slug', LOJA_SLUG).single();
  if (error || !loja) throw error || new Error('Loja não encontrada');
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supa.from('categorias').select('*').eq('loja_id', loja.id).order('ordem'),
    supa.from('produtos').select('*').eq('loja_id', loja.id).order('ordem'),
  ]);
  applyMenu(loja, cats || [], prods || []);
  store.set('adl_menu_cache', { loja, cats, prods });
}
function applyMenu(loja, cats, prods) {
  S.loja = loja;
  S.cats = cats.filter(c => c.ativa);
  S.prods = prods.map(p => ({ ...p, preco: Number(p.preco), ing: ingredientes(p.descricao) }));
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

let reloadTimer;
function subscribeRealtime() {
  const id = S.loja.id;
  const reload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => { await loadMenu(); syncCart(); renderAll(); }, 300);
  };
  supa.channel('cardapio-' + id)
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
  const m = now.getHours() * 60 + now.getMinutes();
  const abre = toMin(h.abre), fecha = toMin(h.fecha);
  const inHours = abre <= fecha ? (m >= abre && m < fecha) : (m >= abre || m < fecha);
  if (l.modo === 'aberta') return { open: true, text: 'Aberto agora' };
  if (l.modo === 'fechada') return { open: false, text: 'Fechado agora' };
  return inHours ? { open: true, text: `Aberto · fecha ${h.fecha}` } : { open: false, text: `Fechado · abre ${h.abre}` };
}

// ── Render ─────────────────────────────────────────────────
function renderAll() {
  renderTop(); renderHero(); renderBrabos(); renderTabs(); renderMenu(); renderAgain(); updateTicket();
}

function renderTop() {
  const st = lojaStatus();
  $('statusText').textContent = st.text;
  $('status').classList.toggle('closed', !st.open);
  const c = S.loja.config || {};
  $('factEntrega').textContent = c.tempo_entrega || '—';
  $('factRetirada').textContent = c.tempo_retirada || '—';
  $('factTaxa').textContent = c.taxa_entrega ? 'R$ ' + fmtShort(c.taxa_entrega) : 'Grátis';
  $('footAddr').textContent = c.endereco || '';
  const painel = typeof PAINEL_URL !== 'undefined' ? PAINEL_URL : '';
  $('gear').hidden = !painel;
  if (painel) $('gear').href = painel;
}

function rankedHighlights() {
  const top = (S.social.top || []).filter(id => S.byId.get(id)?.disponivel);
  const dest = S.prods.filter(p => p.destaque && p.disponivel)
    .sort((a, b) => (b.tags.includes('mais-pedido') - a.tags.includes('mais-pedido')) || (!!b.foto_url - !!a.foto_url) || b.preco - a.preco);
  const ids = [...new Set([...top, ...dest.map(p => p.id)])];
  return ids.map(id => S.byId.get(id)).filter(isLanche).slice(0, 6);
}

function renderHero() {
  const hero = rankedHighlights().find(p => p.foto_url) || S.prods.find(p => p.foto_url);
  if (!hero) return;
  $('heroImg').src = hero.foto_url;
  $('heroImg').alt = hero.nome;
  $('heroPrice').innerHTML = `<span><small>SÓ</small>R$${fmtShort(hero.preco)}</span>`;
  $('heroTag').textContent = 'O ' + hero.nome.replace(/^Especial\s+/i, '');
  $('heroPhoto').onclick = () => openItem(hero.id);
  const n = S.social.pedidos_hoje || 0;
  document.querySelector('.kicker').textContent = n >= 5 ? `🔥 ${n} pedidos saíram hoje` : 'Cardápio oficial · peça direto, sem app';
}

function renderBrabos() {
  $('brabos').innerHTML = rankedHighlights().map((p, i) => `
    <button class="brabo" type="button" onclick="openItem('${p.id}')">
      <div class="brabo-img">
        ${p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy">` : `<div class="art">${art(130)}</div>`}
        <span class="brabo-rank">#${i + 1}</span>
      </div>
      <div class="brabo-body">
        <div><div class="brabo-name">${esc(p.nome)}</div><div class="brabo-ing">${esc(p.ing.slice(1, 5).join(' · '))}${p.ing.length > 5 ? '…' : ''}</div></div>
        <div class="brabo-price"><small>R$</small>${fmtShort(p.preco)}</div>
      </div>
    </button>`).join('');
}

const catShort = c => ({ 'prensados-salsicha': 'Salsicha', 'lanches-hamburguer': 'Burger', vegetarianos: 'Veggie', molhos: 'Molho', bebidas: 'Geladas', 'bebidas-alcoolicas': 'Cervejas' }[c.slug] || c.nome);
function renderTabs() {
  $('tabs').innerHTML = `<div class="tabs-inner">${S.cats.map((c, i) =>
    `<button class="tab ${i === 0 ? 'active' : ''}" data-cat="${c.id}" onclick="goCat('${c.id}')">${esc(catShort(c))}<sup>${S.prods.filter(p => p.categoria_id === c.id && p.disponivel).length}</sup></button>`).join('')}</div>`;
}
function goCat(id) {
  const el = document.getElementById('cat-' + id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - $('tabs').offsetHeight + 2, behavior: 'smooth' });
}

function renderMenu() {
  const topSet = new Set((S.social.top || []).slice(0, 3));
  $('menu').innerHTML = S.cats.map(c => {
    const list = S.prods.filter(p => p.categoria_id === c.id);
    if (!list.length) return '';
    if (c.slug.startsWith('bebidas')) return renderFridge(c, list);
    const common = S.common[c.id] || new Set();
    return `<section class="cat" id="cat-${c.id}">
      <div class="cat-head"><h2>${esc(c.nome)}</h2><span>${list.length} opções</span></div>
      ${list.map((p, i) => {
        const qty = S.cart.filter(l => l.id === p.id).reduce((s, l) => s + l.qty, 0);
        const ing = p.ing.map(x => common.has(x) || x === 'pão' ? esc(x) : `<b>${esc(x)}</b>`).join(', ');
        const tags = [];
        if (topSet.has(p.id) || p.tags.includes('mais-pedido')) tags.push('<span class="tag hot">🔥 Mais pedido</span>');
        if (p.tags.includes('favorito')) tags.push('<span class="tag yel">❤ Favorito da casa</span>');
        if (p.tags.includes('monstro')) tags.push('<span class="tag yel">Monstro</span>');
        if (p.tags.includes('premium')) tags.push('<span class="tag yel">Premium</span>');
        if (p.tags.includes('veggie')) tags.push('<span class="tag">🌱 Veggie</span>');
        return `<article class="row ${p.disponivel ? '' : 'off'}" onclick="openItem('${p.id}')">
          <div class="row-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="row-main">
            <div class="row-line"><h3 class="row-name">${esc(p.nome)}</h3><i class="row-leader"></i><span class="row-price"><small>R$</small>${fmtShort(p.preco)}</span></div>
            ${ing ? `<p class="row-ing">${ing}</p>` : ''}
            ${tags.length ? `<div class="row-tags">${tags.join('')}</div>` : ''}
          </div>
          <div class="row-side">
            ${p.foto_url ? `<img class="row-thumb" src="${esc(p.foto_url)}" alt="" loading="lazy">` : ''}
            <button class="add ${qty ? 'in' : ''}" aria-label="Adicionar ${esc(p.nome)}" onclick="event.stopPropagation();quickAdd('${p.id}',this)">${qty ? qty + 'x' : '+'}</button>
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('');
  observeCats();
}

function shelfOf(p) {
  if (isAlcohol(p)) return bevLook(p).shape === 'ks' ? 'Long neck' : 'Latas';
  const s = bevLook(p).shape;
  if (s === 'lata') return 'Latinhas 350ml';
  if (s === 'ks') return 'Garrafinhas';
  if (s === 'pet') return /600/.test(p.nome) ? '600ml' : 'Águas';
  if (s === 'pet2') return '2 litros · pra galera';
  return 'Sucos & energéticos';
}
function bevHTML(p, origem = 'cardapio') {
  const qty = S.cart.filter(l => l.id === p.id).reduce((s, l) => s + l.qty, 0);
  return `<button class="bev" type="button" onclick="addDrink('${p.id}','${origem}',this)" aria-label="Adicionar ${esc(p.nome)}">
    ${qty ? `<span class="bev-qty">${qty}</span>` : ''}
    ${canHTML(p)}
    <span class="bev-name">${esc(p.nome)}</span>
    <span class="bev-price">${fmtShort(p.preco)}</span>
  </button>`;
}
function renderFridge(c, list) {
  const order = ['Latinhas 350ml', 'Garrafinhas', '600ml', 'Sucos & energéticos', 'Águas', 'Long neck', 'Latas'];
  const groups = {};
  list.filter(p => p.disponivel).forEach(p => (groups[shelfOf(p)] ||= []).push(p));
  return `<section class="cat" id="cat-${c.id}">
    <div class="cat-head"><h2>${c.slug === 'bebidas-alcoolicas' ? 'Cervejas' : 'A geladeira'}</h2><span>${c.slug === 'bebidas-alcoolicas' ? 'proibido para menores de 18' : 'toque pra pegar'}</span></div>
    <p class="cat-note">Tudo trincando. Toca na bebida que ela vai pra comanda.</p>
    <div class="fridge">
      ${order.filter(g => groups[g]).map(g => `<div class="shelf-label">${g}</div><div class="shelf">${groups[g].map(p => bevHTML(p)).join('')}</div>`).join('')}
    </div>
  </section>`;
}

let catObserver;
function observeCats() {
  catObserver?.disconnect();
  catObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id.replace('cat-', '');
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.cat === id));
      document.querySelector(`.tab[data-cat="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.cat').forEach(el => catObserver.observe(el));
}

// ── Cliente que volta ──────────────────────────────────────
function renderAgain() {
  const last = store.get('adl_ultimo');
  const cli = store.get('adl_cliente');
  const el = $('again');
  if (!last || !last.itens?.length || S.cart.length) { el.hidden = true; return; }
  const itens = last.itens.filter(i => S.byId.get(i.id)?.disponivel);
  if (!itens.length) { el.hidden = true; return; }
  const resumo = itens.map(i => `${i.qty}x ${S.byId.get(i.id).nome}`).join(', ');
  const nome = cli?.nome ? cli.nome.split(' ')[0] : '';
  el.innerHTML = `<div class="again-emoji">👋</div>
    <div class="again-text"><b>${nome ? `Fala, ${esc(nome)}!` : 'Bem-vindo de volta!'} Repete o de sempre?</b><span>${esc(resumo)}</span></div>
    <button class="again-btn" onclick="repeatLast()">Repetir</button>`;
  el.hidden = false;
}
function repeatLast() {
  const last = store.get('adl_ultimo');
  (last?.itens || []).forEach(i => { if (S.byId.get(i.id)?.disponivel) addLine({ id: i.id, qty: i.qty, remove: i.remove || [], obs: i.obs || '', origem: 'repetir' }); });
  buzz(); openReceipt();
}

// ── Carrinho ───────────────────────────────────────────────
const lineKey = l => `${l.id}|${[...(l.remove || [])].sort().join(',')}|${l.obs || ''}|${l.origem}`;
function addLine(line) {
  const l = { remove: [], obs: '', origem: 'cardapio', qty: 1, ...line };
  l.key = lineKey(l);
  const ex = S.cart.find(x => x.key === l.key);
  if (ex) ex.qty += l.qty; else S.cart.push(l);
  saveCart();
}
function saveCart() { store.set('adl_cart', S.cart); updateTicket(); refreshQtyBadges(); }
function syncCart() {
  const before = S.cart.length;
  S.cart = S.cart.filter(l => S.byId.get(l.id)?.disponivel);
  if (S.cart.length < before) toast('Um item acabou e saiu da sua comanda');
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

// Frete grátis: só aparece se a loja configurar um valor no painel
function freteFalta() {
  const g = Number(S.loja?.config?.frete_gratis_acima || 0);
  if (!g || S.mode !== 'delivery') return null;
  return { meta: g, falta: Math.max(0, g - subtotal()) };
}
function freteHTML() {
  const f = freteFalta(); if (!f) return '';
  const pct = Math.min(100, subtotal() / f.meta * 100);
  return `<div class="frete"><div class="frete-txt">${f.falta > 0 ? `🛵 Faltam <b>${fmt(f.falta)}</b> pro frete grátis` : '🎉 Você ganhou <b>frete grátis</b>!'}</div><div class="frete-bar"><i style="width:${pct}%"></i></div></div>`;
}

function updateTicket() {
  const n = count();
  const f = freteFalta();
  document.querySelector('.ticket-label').textContent = f && n ? (f.falta > 0 ? `Faltam ${fmt(f.falta)} p/ frete grátis` : 'Frete grátis 🎉') : 'Ver comanda';
  $('ticketCount').textContent = n;
  $('ticketTotal').textContent = fmt(subtotal());
  $('ticket').classList.toggle('show', n > 0 && !$('sheet').classList.contains('open'));
}
function refreshQtyBadges() {
  // re-render barato das quantidades sem rerender do menu inteiro
  document.querySelectorAll('.row').forEach(row => {
    const btn = row.querySelector('.add'); if (!btn) return;
    const id = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
    const q = S.cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
    btn.classList.toggle('in', q > 0); btn.textContent = q ? q + 'x' : '+';
  });
  document.querySelectorAll('.bev').forEach(b => {
    const id = b.getAttribute('onclick').match(/'([^']+)'/)[1];
    const q = S.cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
    let badge = b.querySelector('.bev-qty');
    if (q && !badge) { badge = document.createElement('span'); badge.className = 'bev-qty'; b.prepend(badge); }
    if (badge) { if (q) badge.textContent = q; else badge.remove(); }
  });
}

function flyFrom(el) {
  const t = $('ticket');
  if (!el || !t) return bumpTicket();
  const a = el.getBoundingClientRect();
  const show = t.classList.contains('show');
  const b = show ? t.getBoundingClientRect() : { left: innerWidth / 2 - 20, top: innerHeight - 60, width: 40, height: 40 };
  const f = $('fly');
  f.textContent = '+1';
  f.animate([
    { opacity: 1, transform: `translate(${a.left + a.width / 2 - 17}px, ${a.top + a.height / 2 - 17}px) scale(1)` },
    { opacity: 1, transform: `translate(${(a.left + b.left) / 2}px, ${Math.min(a.top, b.top) - 90}px) scale(1.3)`, offset: .45 },
    { opacity: 0, transform: `translate(${b.left + 30}px, ${b.top + b.height / 2 - 17}px) scale(.5)` },
  ], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = bumpTicket;
}
function bumpTicket() { const t = $('ticket'); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }

function quickAdd(id, el) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  addLine({ id, origem: 'cardapio' });
  buzz(); flyFrom(el); afterAdd(p);
}
function addDrink(id, origem, el) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  if (/com ou sem g[aá]s/i.test(p.descricao || '')) return openWaterChoice(p, origem);
  addLine({ id, origem });
  buzz(); flyFrom(el);
  if ($('sheet').classList.contains('open')) refreshSheet(); else toast(`${p.nome} na comanda 🧊`);
}
function afterAdd(p) {
  if (isLanche(p) && drinksInCart() === 0 && S.drinkAsked < 2) {
    S.drinkAsked++;
    setTimeout(() => openDrinkUpsell(p), 420);
  } else {
    toast(`${p.nome} na comanda`);
  }
}

// ── Sheet único ────────────────────────────────────────────
let sheetView = null; // função que re-renderiza o conteúdo atual
function openSheet(render, { paper = false } = {}) {
  sheetView = render;
  const sh = $('sheet');
  sh.classList.toggle('paper', paper);
  $('sheetBody').innerHTML = render();
  $('sheetBody').scrollTop = 0;
  if (!sh.classList.contains('open')) {
    sh.classList.add('open'); $('scrim').classList.add('open'); document.body.classList.add('lock');
    history.pushState({ sheet: 1 }, '');
  }
  updateTicket();
}
function refreshSheet() {
  if (!sheetView) return;
  const body = $('sheetBody'); const y = body.scrollTop;
  body.innerHTML = sheetView(); body.scrollTop = y;
}
function closeSheet(fromPop = false) {
  const sh = $('sheet');
  if (!sh.classList.contains('open')) return;
  sh.classList.remove('open'); $('scrim').classList.remove('open'); document.body.classList.remove('lock');
  sheetView = null; stopTrackPoll();
  if (!fromPop && history.state?.sheet) history.back();
  setTimeout(updateTicket, 200);
}
window.addEventListener('popstate', () => closeSheet(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('scrim').onclick = () => closeSheet();
$('ticket').onclick = () => openReceipt();

// ── Tela do item ───────────────────────────────────────────
let IT = null;
function openItem(id) {
  const p = S.byId.get(id); if (!p) return;
  if (isDrink(p)) return addDrink(id, 'cardapio');
  if (!isLanche(p)) return quickAdd(id);
  IT = { id, remove: new Set(), upgrade: false, qty: 1, obs: '', obsOpen: false };
  openSheet(itemView);
}
function itemView() {
  const p = S.byId.get(IT.id);
  const up = p.upgrade_para && S.byId.get(p.upgrade_para);
  const upOk = up && up.disponivel;
  const shown = IT.upgrade && upOk ? up : p;
  const extra = upOk ? up.ing.filter(i => !p.ing.includes(i)) : [];
  const unit = shown.preco;
  return `
    <div class="it-media">
      <button class="it-close" onclick="closeSheet()" aria-label="Fechar">✕</button>
      ${shown.foto_url ? `<img src="${esc(shown.foto_url)}" alt="${esc(shown.nome)}">` : `<div class="art">${art(170)}</div>`}
      <span class="burst"><span>R$${fmtShort(unit)}</span></span>
    </div>
    <div class="it-body">
      <h2 class="it-name">${esc(shown.nome)}</h2>
      ${shown.ing.length ? `<p class="it-hint">Vai no lanche · toque pra tirar</p>
      <div class="chips">${shown.ing.map(i => `<button class="chip ${i === 'pão' ? 'fixed' : ''} ${IT.remove.has(i) ? 'removed' : ''}" onclick="toggleIng('${esc(i).replace(/'/g, '&#39;')}')">${esc(i)}</button>`).join('')}</div>` : ''}
      ${upOk ? `<button class="upgrade ${IT.upgrade ? 'on' : ''}" onclick="toggleUpgrade()">
        <span class="upgrade-ico">⚡</span>
        <span class="upgrade-txt"><small>Turbina por + ${fmt(up.preco - p.preco)}</small><b>Vira ${esc(up.nome)}</b>
        <span>${extra.length ? 'Ganha ' + extra.map(e => `<em>+ ${esc(e)}</em>`).join(' ') : 'Versão mais caprichada'}</span></span>
        <span class="switch"></span>
      </button>` : ''}
      ${IT.obsOpen
        ? `<div style="margin-top:16px"><textarea class="field" id="itObs" maxlength="140" placeholder="Ex.: bem passado, molho à parte…" oninput="IT.obs=this.value">${esc(IT.obs)}</textarea></div>`
        : `<button class="obs-toggle" onclick="IT.obsOpen=true;refreshSheet();setTimeout(()=>$('itObs')?.focus(),50)">+ Alguma observação?</button>`}
    </div>
    <div class="it-foot">
      <div class="qty"><button onclick="itQty(-1)" aria-label="Menos">−</button><span>${IT.qty}</span><button onclick="itQty(1)" aria-label="Mais">+</button></div>
      <button class="btn" onclick="itConfirm(this)"><span>Bota na comanda</span><span>${fmt(unit * IT.qty)}</span></button>
    </div>`;
}
function toggleIng(i) { IT.remove.has(i) ? IT.remove.delete(i) : IT.remove.add(i); buzz(); refreshSheet(); }
function toggleUpgrade() { IT.upgrade = !IT.upgrade; buzz(); refreshSheet(); }
function itQty(d) { IT.qty = Math.max(1, Math.min(20, IT.qty + d)); refreshSheet(); }
function itConfirm(el) {
  const p = S.byId.get(IT.id);
  const up = p.upgrade_para && S.byId.get(p.upgrade_para);
  const final = IT.upgrade && up?.disponivel ? up : p;
  addLine({
    id: final.id, qty: IT.qty,
    remove: [...IT.remove].filter(i => final.ing.includes(i)),
    obs: (IT.obs || '').trim(),
    origem: final === p ? 'cardapio' : 'upgrade',
  });
  buzz(); flyFrom(el);
  const wantsDrink = drinksInCart() === 0 && S.drinkAsked < 2;
  if (wantsDrink) { S.drinkAsked++; openDrinkUpsell(final); }
  else { closeSheet(); toast(`${final.nome} na comanda`); }
}

// ── Upsell de bebida ───────────────────────────────────────
function upsellDrinks() {
  const picks = [/^coca-cola lata/i, /^guaraná antarctica lata/i, /^coca-cola zero lata/i, /^fanta lata/i, /^sprite lata/i, /^água/i];
  return picks.map(findProd).filter(Boolean);
}
function familyDeal() {
  const n = lanchesInCart();
  const big = findProd(/^coca-cola 2l/i);
  const lata = findProd(/^coca-cola lata/i);
  if (n < 2 || !big || !lata) return null;
  if (S.cart.some(l => /2l/i.test(S.byId.get(l.id)?.nome || ''))) return null;
  const save = n * lata.preco - big.preco;
  return { big, n, save };
}
function openDrinkUpsell(p) {
  openSheet(() => {
    const deal = familyDeal();
    const has = drinksInCart();
    return `
    <div class="up-head">
      <small>${p ? esc(p.nome) + ' tá na comanda ✓' : 'Comanda'}</small>
      <h3>Lanche sem<br>gelada é crime.</h3>
      <p>Toca na bebida pra levar junto.</p>
    </div>
    <div class="fridge up-fridge"><div class="shelf">${upsellDrinks().map(d => bevHTML(d, 'upsell')).join('')}</div></div>
    ${deal ? `<button class="deal" onclick="addDrink('${deal.big.id}','upsell',this)">
      <span style="font-size:1.8rem">🧊</span>
      <span class="deal-txt"><b>Pra galera: ${esc(deal.big.nome)}</b>${deal.save > 0 ? `Sai mais em conta que ${deal.n} latas: <em>economiza ${fmt(deal.save)}</em>` : `Dá pra todo mundo por ${fmt(deal.big.preco)}`}</span>
      <span class="deal-add">+ ${fmt(deal.big.preco)}</span>
    </button>` : ''}
    <div class="rc-actions">
      <button class="btn ${has ? '' : 'ghost'} center" onclick="closeSheet()">${has ? 'Fechou, voltar pro cardápio' : 'Tô de boa, sem bebida'}</button>
      ${has ? `<button class="btn dark" onclick="openReceipt()"><span>Ver comanda</span><span>${fmt(subtotal())}</span></button>` : ''}
    </div>`;
  });
}
function openWaterChoice(p, origem) {
  openSheet(() => `
    <div class="up-head"><small>Água mineral</small><h3>Com ou<br>sem gás?</h3></div>
    <div class="rc-actions">
      <button class="btn center" onclick="addLine({id:'${p.id}',obs:'Sem gás',origem:'${origem}'});buzz();afterWater()">Sem gás</button>
      <button class="btn dark center" onclick="addLine({id:'${p.id}',obs:'Com gás',origem:'${origem}'});buzz();afterWater()">Com gás</button>
    </div>`);
}
function afterWater() { toast('Água na comanda 💧'); closeSheet(); }

// ── Comanda ────────────────────────────────────────────────
function lineObs(l) { return [l.remove?.length ? 'SEM ' + l.remove.join(', ') : '', l.obs].filter(Boolean).join(' · '); }
function suggestions() {
  const out = [];
  if (drinksInCart() === 0) {
    const d = upsellDrinks().slice(0, 4);
    if (d.length) out.push(`<div class="rc-sug" style="flex-wrap:wrap"><span class="rc-sug-ico">🥤</span>
      <div class="rc-sug-txt"><b>Faltou a gelada</b>Um toque e vai junto.</div>
      <div class="rc-mini" style="width:100%">${d.map(x => `<button onclick="addLine({id:'${x.id}',origem:'bump'});buzz();refreshSheet()">${esc(bevLook(x).label)} lata · ${fmtShort(x.preco)}</button>`).join('')}</div></div>`);
  }
  const cand = S.cart.find(l => l.origem !== 'upgrade' && (() => { const p = S.byId.get(l.id); const u = p?.upgrade_para && S.byId.get(p.upgrade_para); return u?.disponivel && isLanche(p); })());
  if (cand) {
    const p = S.byId.get(cand.id), u = S.byId.get(p.upgrade_para);
    const extra = u.ing.filter(i => !p.ing.includes(i));
    out.push(`<div class="rc-sug"><span class="rc-sug-ico">⚡</span>
      <div class="rc-sug-txt"><b>Turbina o ${esc(p.nome)}?</b>Vira ${esc(u.nome)}${extra.length ? ' (+ ' + esc(extra.join(', ')) + ')' : ''} por + ${fmt(u.preco - p.preco)}${cand.qty > 1 ? ' cada' : ''}.</div>
      <button class="rc-sug-btn" onclick="upgradeLine('${cand.key}')">Turbinar</button></div>`);
  }
  const deal = familyDeal();
  if (deal && drinksInCart() > 0 && out.length < 2) {
    out.push(`<div class="rc-sug"><span class="rc-sug-ico">🧊</span>
      <div class="rc-sug-txt"><b>Pra galera</b>${esc(deal.big.nome)} por ${fmt(deal.big.preco)}.</div>
      <button class="rc-sug-btn" onclick="addLine({id:'${deal.big.id}',origem:'bump'});buzz();refreshSheet()">+ Levar</button></div>`);
  }
  return out.slice(0, 2).join('');
}
function upgradeLine(key) {
  const l = S.cart.find(x => x.key === key); if (!l) return;
  const p = S.byId.get(l.id), u = S.byId.get(p.upgrade_para);
  S.cart = S.cart.filter(x => x !== l);
  addLine({ id: u.id, qty: l.qty, remove: (l.remove || []).filter(i => u.ing.includes(i)), obs: l.obs, origem: 'upgrade' });
  buzz(); toast(`Turbinado: ${u.nome} ⚡`); refreshSheet();
}
function changeLine(key, d) {
  const l = S.cart.find(x => x.key === key); if (!l) return;
  l.qty += d;
  if (l.qty <= 0) S.cart = S.cart.filter(x => x !== l);
  saveCart(); buzz();
  if (!S.cart.length) closeSheet(); else refreshSheet();
}
function setMode(m) { S.mode = m; buzz(); refreshSheet(); updateTicket(); }

function openReceipt() { openSheet(receiptView, { paper: true }); }
function receiptView() {
  const c = S.loja.config || {};
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (!S.cart.length) return `<div class="receipt"><div class="empty"><b>Comanda vazia</b><p>Bora escolher um prensado?</p></div></div>
    <div class="rc-actions"><button class="btn center" onclick="closeSheet()">Ver cardápio</button></div>`;
  const tx = taxa();
  return `
    <div class="receipt">
      <div class="rc-head"><b>Comanda</b><span>ADRIANO LANCHES · ${now}</span></div>
      ${S.cart.map(l => {
        const p = S.byId.get(l.id); if (!p) return '';
        const o = lineObs(l);
        return `<div class="rc-item">
          <div class="rc-name">${l.qty}x ${esc(p.nome)}</div><div class="rc-price">${fmt(p.preco * l.qty)}</div>
          ${o ? `<div class="rc-obs">${esc(o)}</div>` : ''}
          <div class="rc-ctrl"><button onclick="changeLine('${l.key}',-1)" aria-label="Menos">−</button><span>${l.qty}</span><button onclick="changeLine('${l.key}',1)" aria-label="Mais">+</button><span class="unit">${fmt(p.preco)} un.</span></div>
        </div>`;
      }).join('')}
      ${suggestions()}
      ${freteHTML()}
      <div class="rc-mode">
        <button class="seg ${S.mode === 'delivery' ? 'on' : ''}" onclick="setMode('delivery')">🛵 Entrega<small>${c.tempo_entrega || ''} · ${c.taxa_entrega ? fmt(c.taxa_entrega) : 'grátis'}</small></button>
        <button class="seg ${S.mode === 'retirada' ? 'on' : ''}" onclick="setMode('retirada')">🏃 Retirada<small>${c.tempo_retirada || ''} · sem taxa</small></button>
      </div>
      <div class="rc-totals">
        <div class="rc-row"><span>Subtotal</span><span>${fmt(subtotal())}</span></div>
        <div class="rc-row"><span>${S.mode === 'delivery' ? 'Entrega' : 'Retirada no balcão'}</span><span class="${tx ? '' : 'free'}">${tx ? fmt(tx) : 'grátis'}</span></div>
        <div class="rc-row total"><span>TOTAL</span><span>${fmt(total())}</span></div>
      </div>
    </div>
    <div class="rc-actions">
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
  const cli = store.get('adl_cliente') || {};
  const st = lojaStatus();
  const c = S.loja.config || {};
  const formas = c.formas_pagamento || ['pix', 'dinheiro', 'cartao'];
  const label = { pix: '⚡ PIX', dinheiro: '💵 Dinheiro', cartao: '💳 Cartão' };
  return `
    <div class="co">
      <button class="co-back" onclick="openReceipt()">← Voltar pra comanda</button>
      <h3>Quase lá,<br>só falta isso.</h3>
      ${st.open ? '' : `<div class="closed-banner" style="margin:14px 0 0">🌙 ${esc(st.text)}. Seu pedido fica salvo aqui até a gente abrir.</div>`}
      <div class="co-sec">
        <span class="co-label">Quem tá pedindo</span>
        <input class="field" id="coNome" autocomplete="name" placeholder="Seu nome" value="${esc(cli.nome || '')}">
        <input class="field" id="coTel" type="tel" inputmode="numeric" autocomplete="tel" placeholder="WhatsApp (44) 9…" value="${esc(cli.tel || '')}" oninput="this.value=maskTel(this.value)">
      </div>
      <div class="co-sec">
        <span class="co-label">Como recebe</span>
        <div class="rc-mode" style="margin:0">
          <button class="seg ${S.mode === 'delivery' ? 'on' : ''}" onclick="keepForm();setMode('delivery')">🛵 Entrega<small>+ ${fmt(c.taxa_entrega || 0)}</small></button>
          <button class="seg ${S.mode === 'retirada' ? 'on' : ''}" onclick="keepForm();setMode('retirada')">🏃 Retirada<small>sem taxa</small></button>
        </div>
        ${S.mode === 'delivery' ? `
          <div class="co-grid"><input class="field" id="coRua" autocomplete="address-line1" placeholder="Rua / Avenida" value="${esc(cli.rua || '')}"><input class="field" id="coNum" inputmode="numeric" placeholder="Nº" value="${esc(cli.numero || '')}"></div>
          <input class="field" id="coBairro" placeholder="Bairro" value="${esc(cli.bairro || '')}">
          <input class="field" id="coComp" placeholder="Complemento / ponto de referência" value="${esc(cli.comp || '')}">`
        : `<div class="co-note">📍 Retire em: <b>${esc(c.endereco || '')}</b></div>`}
      </div>
      <div class="co-sec">
        <span class="co-label">Pagamento ${S.mode === 'delivery' ? 'na entrega' : 'na retirada'}</span>
        <div class="pay">${formas.map(f => `<button class="seg ${S.pay === f ? 'on' : ''}" onclick="keepForm();S.pay='${f}';refreshSheet()">${label[f]}</button>`).join('')}</div>
        ${S.pay === 'dinheiro' ? `<input class="field" id="coTroco" inputmode="decimal" placeholder="Troco pra quanto? (opcional)" value="${esc(cli.troco || '')}">` : ''}
        ${S.pay === 'pix' ? `<div class="co-note">${c.chave_pix ? `Chave PIX: <b>${esc(c.chave_pix)}</b>. Pode pagar agora ou na entrega.` : 'A gente te passa a chave PIX pelo WhatsApp assim que o pedido entrar.'}</div>` : ''}
      </div>
      <div class="co-sec">
        <span class="co-label">Observação do pedido</span>
        <textarea class="field" id="coObs" maxlength="300" placeholder="Opcional">${esc(cli.obsPedido || '')}</textarea>
      </div>
      <div class="rc-totals" style="font-family:var(--f-mono)">
        <div class="rc-row"><span>${count()} ${count() === 1 ? 'item' : 'itens'}</span><span>${fmt(subtotal())}</span></div>
        <div class="rc-row"><span>${S.mode === 'delivery' ? 'Entrega' : 'Retirada'}</span><span class="${taxa() ? '' : 'free'}">${taxa() ? fmt(taxa()) : 'grátis'}</span></div>
        <div class="rc-row total"><span>TOTAL</span><span>${fmt(total())}</span></div>
      </div>
      <p class="co-err" id="coErr"></p>
    </div>
    <div class="it-foot">
      <button class="btn" id="coBtn" onclick="placeOrder()" ${st.open ? '' : 'disabled'}><span>${st.open ? 'Mandar pra chapa' : 'Loja fechada'}</span><span>${fmt(total())}</span></button>
    </div>`;
}
// guarda o que já foi digitado antes de re-renderizar o form
function keepForm() {
  const v = id => $(id)?.value;
  const cli = store.get('adl_cliente') || {};
  const next = { ...cli };
  [['nome', 'coNome'], ['tel', 'coTel'], ['rua', 'coRua'], ['numero', 'coNum'], ['bairro', 'coBairro'], ['comp', 'coComp'], ['troco', 'coTroco'], ['obsPedido', 'coObs']]
    .forEach(([k, id]) => { if (v(id) !== undefined) next[k] = v(id); });
  store.set('adl_cliente', next);
}

async function placeOrder() {
  keepForm();
  const cli = store.get('adl_cliente') || {};
  const err = m => { $('coErr').textContent = m; $('coErr').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  if (!cli.nome?.trim()) return err('Coloca seu nome 🙂');
  if ((cli.tel || '').replace(/\D/g, '').length < 10) return err('WhatsApp com DDD, por favor.');
  if (S.mode === 'delivery' && (!cli.rua?.trim() || !cli.numero?.trim() || !cli.bairro?.trim())) return err('Falta rua, número ou bairro.');
  if (!S.pay) return err('Escolhe a forma de pagamento.');

  const btn = $('coBtn'); btn.disabled = true; btn.firstElementChild.textContent = 'Enviando…';
  const pedido = {
    cliente_nome: cli.nome.trim(), cliente_telefone: cli.tel,
    tipo_entrega: S.mode, forma_pagamento: S.pay,
    endereco: S.mode === 'delivery' ? { rua: cli.rua, numero: cli.numero, bairro: cli.bairro, complemento: cli.comp || null } : null,
    troco_para: S.pay === 'dinheiro' && cli.troco ? String(cli.troco).replace(',', '.').replace(/[^\d.]/g, '') : null,
    observacoes: cli.obsPedido || null,
  };
  const itens = S.cart.map(l => ({ produto_id: l.id, quantidade: l.qty, observacao: lineObs(l) || null, origem: l.origem }));
  const { data, error } = await supa.rpc('criar_pedido', { p_loja_slug: LOJA_SLUG, p_pedido: pedido, p_itens: itens });
  if (error) {
    btn.disabled = false; btn.firstElementChild.textContent = 'Mandar pra chapa';
    return err(error.message || 'Não deu pra enviar. Tenta de novo?');
  }
  store.set('adl_cliente', { ...cli, mode: S.mode, pay: S.pay, obsPedido: '' });
  store.set('adl_ultimo', { at: Date.now(), itens: S.cart.map(l => ({ id: l.id, qty: l.qty, remove: l.remove, obs: l.obs })), total: data.total });
  store.set('adl_pedido', { token: data.token, numero: data.numero, at: Date.now() });
  S.cart = []; S.drinkAsked = 0; saveCart(); renderAgain();
  openTrack(data.token, data.numero, true);
  loadSocial();
}

// ── Acompanhamento ─────────────────────────────────────────
let trackTimer = null, trackData = null;
function stopTrackPoll() { clearInterval(trackTimer); trackTimer = null; }
function openTrack(token, numero, fresh = false) {
  trackData = { numero, status: 'novo', tipo_entrega: S.mode, itens: [] };
  openSheet(() => trackView(fresh));
  const poll = async () => {
    const { data } = await supa.rpc('status_pedido', { p_token: token });
    if (data) { trackData = data; refreshSheet(); renderLivePill(); }
  };
  poll(); stopTrackPoll(); trackTimer = setInterval(poll, 8000);
}
function trackView(fresh) {
  const d = trackData;
  const ret = d.tipo_entrega === 'retirada';
  const steps = [
    ['novo', '🧾', 'Pedido recebido'],
    ['preparo', '🔥', 'Na chapa'],
    ['pronto', ret ? '🛎️' : '🛵', ret ? 'Pronto pra retirar' : 'Saiu pra entrega'],
    ['finalizado', '✅', ret ? 'Retirado' : 'Entregue'],
  ];
  const rank = { novo: 0, preparo: 1, pronto: 2, entrega: 2, finalizado: 3 };
  const cur = rank[d.status] ?? 0;
  const num = '#' + String(d.numero).padStart(3, '0');
  if (d.status === 'cancelado') return `<div class="track"><div class="stamp" style="border-color:var(--ink);color:var(--ink)">Cancelado<small>${num}</small></div><p>O restaurante cancelou esse pedido. Chama a gente no WhatsApp se tiver dúvida.</p><div class="rc-actions"><button class="btn center" onclick="clearActive();closeSheet()">Fechar</button></div></div>`;
  return `<div class="track">
    <div class="stamp" ${fresh ? '' : 'style="animation:none"'}>${cur >= 3 ? 'Entregue' : 'Recebido'}<small>Pedido ${num}</small></div>
    <p>${cur >= 3 ? 'Valeu demais! Bom apetite 🍔' : 'Pode fechar essa tela: a gente avisa aqui em cima quando mudar.'}</p>
    <ol class="steps">${steps.map(([, ico, txt], i) => `<li class="${i < cur || cur === 3 ? 'done' : i === cur ? 'now' : ''}"><i>${i < cur || cur === 3 ? '✓' : ico}</i>${txt}</li>`).join('')}</ol>
    ${d.itens?.length ? `<div class="track-items">${d.itens.map(i => `${i.qtd}x ${esc(i.nome)}`).join('<br>')}<br><b>Total ${fmt(d.total)}</b></div>` : ''}
    <div class="rc-actions"><button class="btn center ${cur >= 3 ? '' : 'ghost'}" onclick="${cur >= 3 ? 'clearActive();' : ''}closeSheet()">${cur >= 3 ? 'Fechar' : 'Voltar pro cardápio'}</button></div>
  </div>`;
}
function clearActive() { store.del('adl_pedido'); renderLivePill(); }
function renderLivePill() {
  const a = store.get('adl_pedido');
  const pill = $('livePill');
  if (!a || (trackData && ['finalizado', 'cancelado'].includes(trackData.status) && trackData.numero === a.numero) || Date.now() - a.at > 6 * 3600e3) {
    if (a && Date.now() - a.at > 6 * 3600e3) store.del('adl_pedido');
    pill.hidden = true; return;
  }
  const label = { novo: 'recebido', preparo: 'na chapa 🔥', pronto: 'pronto!', entrega: 'saiu pra entrega 🛵' }[trackData?.numero === a.numero ? trackData.status : 'novo'];
  pill.innerHTML = `<span class="dot"></span>Pedido #${String(a.numero).padStart(3, '0')} · ${label}`;
  pill.hidden = false;
  pill.onclick = () => openTrack(a.token, a.numero);
}
async function checkActive() {
  const a = store.get('adl_pedido'); if (!a) return;
  const { data } = await supa.rpc('status_pedido', { p_token: a.token });
  if (!data) { store.del('adl_pedido'); return; }
  trackData = data; renderLivePill();
  // atualiza o pill em segundo plano enquanto o pedido estiver vivo
  if (!['finalizado', 'cancelado'].includes(data.status)) setTimeout(checkActive, 20000);
}

// ── Toast ──────────────────────────────────────────────────
let toastT;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Init ───────────────────────────────────────────────────
(async function init() {
  const cache = store.get('adl_menu_cache');
  if (cache?.loja) { applyMenu(cache.loja, cache.cats || [], cache.prods || []); syncCart(); renderAll(); }
  try {
    await Promise.all([loadMenu(), loadSocial()]);
    syncCart(); renderAll(); subscribeRealtime(); checkActive();
    setInterval(renderTop, 60000);
  } catch (e) {
    console.error(e);
    if (!cache) $('menu').innerHTML = '<div class="empty" style="padding:60px 16px"><b>Ops, sem conexão</b><p>Recarrega a página em alguns segundos.</p></div>';
  }
})();

Object.assign(window, {
  openItem, quickAdd, addDrink, goCat, repeatLast, closeSheet, refreshSheet, toggleIng, toggleUpgrade, itQty, itConfirm,
  openReceipt, openCheckout, changeLine, upgradeLine, setMode, keepForm, placeOrder, maskTel, addLine, buzz, afterWater,
  clearActive,
});
