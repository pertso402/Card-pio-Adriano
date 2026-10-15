// ═══════════════════════════════════════════════════════════
//  ADRIANO LANCHES v2 — "Na Chapa"
//  Loja e produtos vêm do Supabase (realtime). Foto real em
//  primeiro plano; produto sem foto usa o desenho do stack.js.
//  Pedido é criado via RPC criar_pedido (preço recalculado no banco).
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
const OUT = 'cubic-bezier(.16, 1, .3, 1)';

// ── Estado ─────────────────────────────────────────────────
const S = {
  loja: null, cats: [], prods: [], byId: new Map(),
  social: { pedidos_hoje: 0, top: [] },
  cart: store.get('adl2_cart', []),          // {key,id,qty,remove[],obs,origem}
  mode: (store.get('adl_cliente') || {}).mode || 'delivery',
  pay: (store.get('adl_cliente') || {}).pay || null,
  drinkAsked: 0, common: {}, hero: null,
  adds: [], addById: new Map(),               // adicionais da loja
};

// ── Produtos ───────────────────────────────────────────────
const catOf = p => S.cats.find(c => c.id === p.categoria_id);
const isDrink = p => !!p && (catOf(p)?.slug || '').startsWith('bebidas');
const isMolho = p => !!p && catOf(p)?.slug === 'molhos';
const isLanche = p => !!p && !isDrink(p) && !isMolho(p);
const acceptsAdds = p => !!catOf(p)?.aceita_adicionais;
const isAlcohol = p => catOf(p)?.slug === 'bebidas-alcoolicas';
const qtyOf = id => S.cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
const drinksInCart = () => S.cart.filter(l => isDrink(S.byId.get(l.id))).reduce((s, l) => s + l.qty, 0);
const lanchesInCart = () => S.cart.filter(l => isLanche(S.byId.get(l.id))).reduce((s, l) => s + l.qty, 0);
const findProd = re => S.prods.find(p => p.disponivel && re.test(p.nome));
const art = (p, opts) => Stack.svg(p.descricao || p.nome, opts);
const addsOf = l => (l.adds || []).map(id => S.addById.get(id)).filter(Boolean);
const linePrice = l => (S.byId.get(l.id)?.preco || 0) + addsOf(l).reduce((s, x) => s + x.preco, 0);
// adicional que vira camada no desenho
const ADD_LAYER = { 'queijo': 'mussarela', 'frango desfiado': 'frango' };
const addLayer = x => ADD_LAYER[x.nome.toLowerCase()] || x.nome.toLowerCase();
const distinct = p => { const c = S.common[p.categoria_id] || new Set(); return p.ing.filter(i => !/^p[aã]o$/.test(i) && !c.has(i)); };

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
const canHTML = p => { const l = bevLook(p); return `<div class="can ${l.shape}" style="--c:${l.c};--c2:${l.c2}"><span>${esc(l.label)}</span></div>`; };
// imagem do produto: foto real > desenho > lata
function molhoArt(p) {
  return /bisnaga/i.test(p.nome)
    ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M44 8h12v10H44z" fill="#E8E2D6" stroke="#23140E" stroke-width="3"/><path d="M38 18h24l6 14v52a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V32z" fill="#3E9B3A" stroke="#23140E" stroke-width="3" stroke-linejoin="round"/><rect x="38" y="46" width="24" height="22" rx="4" fill="#FFF6E9"/><path d="M43 57h14" stroke="#3E9B3A" stroke-width="4" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 30h56l-4 44H26z" fill="#3E9B3A" stroke="#23140E" stroke-width="3" stroke-linejoin="round"/><path d="M22 30l6-8h44l6 8" fill="#5CB84F" stroke="#23140E" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="52" r="11" fill="#FFF6E9"/><path d="M45 52q5-6 10 0" stroke="#3E9B3A" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
}
function media(p) {
  if (isMolho(p)) return molhoArt(p);
  if (isDrink(p)) return `<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;transform:scale(.5);transform-origin:50% 92%">${canHTML(p)}</div>`;
  return p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy" decoding="async">` : art(p);
}

// ── Carregamento ───────────────────────────────────────────
async function loadMenu() {
  const { data: loja, error } = await supa.from('lojas').select('*').eq('slug', LOJA_SLUG).single();
  if (error || !loja) throw error || new Error('Loja não encontrada');
  const [{ data: cats }, { data: prods }, { data: adds }] = await Promise.all([
    supa.from('categorias').select('*').eq('loja_id', loja.id).order('ordem'),
    supa.from('produtos').select('*').eq('loja_id', loja.id).order('ordem'),
    supa.from('adicionais').select('*').eq('loja_id', loja.id).order('ordem'),
  ]);
  applyMenu(loja, cats || [], prods || [], adds || []);
  store.set('adl2_menu', { loja, cats, prods, adds });
}
function applyMenu(loja, cats, prods, adds = []) {
  S.loja = loja;
  S.adds = adds.filter(x => x.disponivel).map(x => ({ ...x, preco: Number(x.preco) }));
  S.addById = new Map(S.adds.map(x => [x.id, x]));
  S.cats = cats.filter(c => c.ativa);
  S.prods = prods.map(p => ({ ...p, preco: Number(p.preco), ing: Stack.ingredientsOf(p.descricao) }));
  S.byId = new Map(S.prods.map(p => [p.id, p]));
  S.common = {};
  for (const c of S.cats) {
    const list = S.prods.filter(p => p.categoria_id === c.id), freq = {};
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
  const reload = () => { clearTimeout(reloadT); reloadT = setTimeout(async () => { await loadMenu(); syncCart(); renderAll(); }, 300); };
  supa.channel('cardapio2-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos', filter: `loja_id=eq.${id}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias', filter: `loja_id=eq.${id}` }, reload)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lojas', filter: `id=eq.${id}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'adicionais', filter: `loja_id=eq.${id}` }, reload)
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
  if (l.modo === 'aberta') return { open: true, text: 'Aberto agora' };
  if (l.modo === 'fechada') return { open: false, text: 'Fechado agora' };
  return inHours ? { open: true, text: `Aberto até ${h.fecha}` } : { open: false, text: `Abre às ${h.abre}` };
}

// ── Render geral ───────────────────────────────────────────
function renderAll() { renderStatus(); renderHero(); renderTabs(); renderMenu(); renderAgain(); updateTray(); }
function renderStatus() {
  const st = lojaStatus(), c = S.loja.config || {};
  $('statusText').textContent = st.text;
  $('status').classList.toggle('closed', !st.open);
  $('factEntrega').textContent = c.tempo_entrega || '—';
  $('factRetirada').textContent = c.tempo_retirada || '—';
  $('factTaxa').textContent = c.taxa_entrega ? short(c.taxa_entrega) : 'Grátis';
  $('footAddr').textContent = c.endereco || '';
  $('footHours').textContent = `todos os dias · ${c.horario?.abre || '19:00'} às ${c.horario?.fecha || '01:00'}`;
  $('footLinks').innerHTML = [c.whatsapp ? `<a href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp ${esc(telBR(c.whatsapp))}</a>` : '', c.instagram ? `<a href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a>` : ''].join('');
  const painel = typeof PAINEL_URL !== 'undefined' ? PAINEL_URL : '';
  $('gear').hidden = !painel; if (painel) $('gear').href = painel;
}

const telBR = t => { const d = String(t).replace(/\D/g, '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d; };

// ── HERO ───────────────────────────────────────────────────
function pickHero() {
  const ok = p => isLanche(p) && p.disponivel && p.foto_url;
  return S.prods.find(p => ok(p) && p.tags.includes('mais-pedido'))
    || (S.social.top || []).map(id => S.byId.get(id)).find(ok)
    || S.prods.find(ok);
}
function renderHero() {
  const p = pickHero(); if (!p) return;
  S.hero = p;
  const img = $('heroImg');
  if (img.getAttribute('src') !== p.foto_url) img.src = p.foto_url;
  img.alt = p.nome;
  $('heroName').textContent = p.nome;
  $('heroIng').textContent = distinct(p).join(' · ') || p.ing.slice(1, 5).join(' · ');
  $('heroPrice').textContent = short(p.preco);
  $('heroBadge').textContent = p.tags.includes('mais-pedido') ? 'Mais pedido' : 'Destaque';
  $('heroCard').onclick = () => openItem(p.id, $('heroCard').querySelector('.hero-media'));
}
// parallax leve da foto do hero
let scrollTick = false;
function onScroll() {
  const y = scrollY;
  $('bar').classList.toggle('solid', y > 24);
  if (y < innerHeight * 1.2) $('heroImg').style.setProperty('--py', `${(y * .12).toFixed(1)}px`);
}
addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(() => { onScroll(); scrollTick = false; }); } }, { passive: true });

// ── Abas com indicador deslizante ──────────────────────────
const catShort = c => ({ 'prensados-salsicha': 'Salsicha', 'lanches-hamburguer': 'Hambúrguer', vegetarianos: 'Veggie', molhos: 'Molho', bebidas: 'Bebidas', 'bebidas-alcoolicas': 'Cervejas' }[c.slug] || c.nome);
function renderTabs() {
  $('tabs').innerHTML = `<div class="tabs-in"><span class="tabs-pill" id="tabsPill"></span>${S.cats.map((c, i) =>
    `<button class="tab ${i === 0 ? 'on' : ''}" data-cat="${c.id}" onclick="goCat('${c.id}')">${esc(catShort(c))}</button>`).join('')}</div>`;
  requestAnimationFrame(() => movePill(document.querySelector('.tab.on'), false));
}
function movePill(tab, animate = true) {
  const pill = $('tabsPill'); if (!pill || !tab) return;
  if (!animate) pill.style.transition = 'none';
  pill.style.width = tab.offsetWidth + 'px';
  pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  if (!animate) requestAnimationFrame(() => pill.style.transition = '');
}
function setTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.cat === id));
  const on = document.querySelector('.tab.on'); movePill(on);
  const box = on?.parentElement; if (box) box.scrollTo({ left: on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
}
let lockObs = 0;
function goCat(id) {
  const el = document.getElementById('cat-' + id); if (!el) return;
  setTab(id); lockObs = Date.now();
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - 128, behavior: 'smooth' });
}
addEventListener('resize', () => movePill(document.querySelector('.tab.on'), false));

// ── Cardápio ───────────────────────────────────────────────
function badge(p) {
  const top = new Set((S.social.top || []).slice(0, 3));
  if (top.has(p.id) || p.tags.includes('mais-pedido')) return '<span class="badge hot">Mais pedido</span>';
  if (p.tags.includes('favorito')) return '<span class="badge">Favorito da casa</span>';
  if (p.tags.includes('monstro')) return '<span class="badge">Monstro</span>';
  if (p.tags.includes('premium')) return '<span class="badge">Premium</span>';
  if (p.tags.includes('veggie')) return '<span class="badge veg">Veggie</span>';
  return '';
}
function rowHTML(p) {
  const c = S.common[p.categoria_id] || new Set();
  const ing = p.ing.filter(i => !/^p[aã]o$/.test(i)).map(i => c.has(i) ? esc(i) : `<b>${esc(i)}</b>`).join(', ');
  const q = qtyOf(p.id);
  const tap = isLanche(p) ? `openItem('${p.id}', this.querySelector('.thumb'))` : `quickAdd('${p.id}', this.querySelector('.thumb'))`;
  return `<article class="row ${p.disponivel ? '' : 'off'} ${isMolho(p) ? 'molho' : ''}" role="button" tabindex="0" onclick="${tap}" onkeydown="if(event.key==='Enter')this.click()">
    <span class="row-txt">
      <span class="row-name">${esc(p.nome)}</span>
      ${ing ? `<span class="row-ing">${ing}</span>` : ''}
      <span class="row-meta"><span class="price"><small>R$</small> ${short(p.preco).replace('R$ ', '')}</span>${badge(p)}</span>
    </span>
    <span class="thumb-wrap"><span class="thumb">${media(p)}</span><span class="add ${q ? 'in' : ''}" data-id="${p.id}" role="button" aria-label="Adicionar ${esc(p.nome)}" onclick="event.stopPropagation();quickAdd('${p.id}', this.previousElementSibling)">${q ? q + 'x' : '+'}</span></span>
  </article>`;
}
function topPicks() {
  const ok = p => isLanche(p) && p.disponivel && p.foto_url;
  const ranked = [...S.prods.filter(p => ok(p) && p.tags.includes('mais-pedido')), ...(S.social.top || []).map(id => S.byId.get(id)).filter(ok), ...S.prods.filter(p => ok(p) && p.destaque), ...S.prods.filter(ok)];
  return [...new Set(ranked)].slice(0, 6);
}
function renderMenu() {
  const picks = topPicks();
  const top = picks.length ? `<section class="top"><div class="top-head"><h2>Os mais pedidos</h2><span>arrasta →</span></div>
    <div class="top-track">${picks.map((p, i) => `<button class="tcard" type="button" onclick="openItem('${p.id}', this)">
      <img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy" decoding="async"><span class="rank">#${i + 1}</span>
      <span class="tcard-info"><span><b>${esc(p.nome)}</b><small>${short(p.preco)}</small></span></span></button>`).join('')}</div></section>` : '';
  $('menu').innerHTML = top + S.cats.map(c => {
    const list = S.prods.filter(p => p.categoria_id === c.id);
    if (!list.length) return '';
    if (c.slug.startsWith('bebidas')) return renderFridge(c, list);
    return `<section class="cat" id="cat-${c.id}"><div class="cat-head"><h2>${esc(c.nome)}</h2><span>${list.length} opções</span></div>
      <div class="list">${list.map(rowHTML).join('')}</div></section>`;
  }).join('');
  observeCats(); reveal();
}
function shelfOf(p) {
  const s = bevLook(p).shape;
  if (isAlcohol(p)) return s === 'ks' ? 'Long neck' : 'Latas';
  if (s === 'lata') return 'Latinhas 350ml';
  if (s === 'ks') return 'Garrafinhas';
  if (s === 'pet') return /600/.test(p.nome) ? '600ml' : 'Águas';
  if (s === 'pet2') return '2 litros · pra galera';
  return 'Sucos & energéticos';
}
function bevHTML(p, origem = 'cardapio') {
  const q = qtyOf(p.id);
  return `<button class="bev" type="button" data-id="${p.id}" onclick="addDrink('${p.id}','${origem}', this.querySelector('.can'))" aria-label="Adicionar ${esc(p.nome)}">
    ${q ? `<span class="bev-qty">${q}</span>` : ''}${canHTML(p)}
    <span class="bev-name">${esc(p.nome)}</span><span class="bev-price">${short(p.preco)}</span></button>`;
}
function renderFridge(c, list) {
  const order = ['Latinhas 350ml', 'Garrafinhas', '600ml', 'Sucos & energéticos', 'Águas', 'Long neck', 'Latas'], groups = {};
  list.filter(p => p.disponivel).forEach(p => (groups[shelfOf(p)] ||= []).push(p));
  const alc = c.slug === 'bebidas-alcoolicas';
  return `<section class="cat" id="cat-${c.id}"><div class="cat-head"><h2>${alc ? 'Cervejas' : 'Bebidas'}</h2><span>${alc ? 'proibido para menores de 18' : 'toca pra pegar'}</span></div>
    <div class="fridge">${order.filter(g => groups[g]).map(g => `<div class="shelf-label">${g}</div><div class="shelf">${groups[g].map(p => bevHTML(p)).join('')}</div>`).join('')}</div></section>`;
}
let catObs;
function observeCats() {
  catObs?.disconnect();
  catObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || Date.now() - lockObs < 900) return;
    setTab(e.target.id.replace('cat-', ''));
  }), { rootMargin: '-35% 0px -60% 0px' });
  document.querySelectorAll('.cat').forEach(el => catObs.observe(el));
}
// entrada suave dos itens conforme aparecem
let revObs;
function reveal() {
  if (reduced) return;
  revObs?.disconnect();
  revObs = new IntersectionObserver(es => {
    let k = 0;
    es.forEach(e => { if (!e.isIntersecting) return; e.target.style.setProperty('--d', `${Math.min(k++, 6) * 60}ms`); e.target.classList.add('in'); revObs.unobserve(e.target); });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.row, .tcard, .fridge, .cat-head').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight) return; // o que já está na tela fica parado
    el.classList.add('pre'); revObs.observe(el);
  });
}
function refreshBadges() {
  document.querySelectorAll('.add[data-id]').forEach(b => { const q = qtyOf(b.dataset.id); b.classList.toggle('in', q > 0); b.textContent = q ? q + 'x' : '+'; });
  document.querySelectorAll('.bev[data-id]').forEach(b => {
    const q = qtyOf(b.dataset.id); let el = b.querySelector('.bev-qty');
    if (q && !el) { el = document.createElement('span'); el.className = 'bev-qty'; b.prepend(el); }
    if (el) { if (q) el.textContent = q; else el.remove(); }
  });
}

// ── Cliente que volta ──────────────────────────────────────
function renderAgain() {
  const last = store.get('adl_ultimo'), cli = store.get('adl_cliente'), el = $('again');
  const itens = (last?.itens || []).filter(i => S.byId.get(i.id)?.disponivel);
  if (!itens.length || S.cart.length) { el.hidden = true; return; }
  const first = S.byId.get((itens.find(i => isLanche(S.byId.get(i.id))) || itens[0]).id);
  const nome = cli?.nome ? cli.nome.split(' ')[0] : '';
  el.innerHTML = `<span class="again-thumb">${media(first)}</span>
    <span class="again-txt"><b>${nome ? `E aí, ${esc(nome)}! ` : ''}Repete o de sempre?</b><span>${esc(itens.map(i => `${i.qty}x ${S.byId.get(i.id).nome}`).join(', '))}</span></span>
    <button onclick="repeatLast()">Repetir</button>`;
  el.hidden = false;
}
function repeatLast() {
  (store.get('adl_ultimo')?.itens || []).forEach(i => { if (S.byId.get(i.id)?.disponivel) addLine({ id: i.id, qty: i.qty, remove: i.remove || [], adds: (i.adds || []).filter(id => S.addById.has(id)), obs: i.obs || '', origem: 'repetir' }); });
  buzz(); openReceipt();
}

// ── Carrinho ───────────────────────────────────────────────
const lineKey = l => `${l.id}|${[...(l.remove || [])].sort().join(',')}|${[...(l.adds || [])].sort().join(',')}|${l.obs || ''}|${l.origem}`;
function addLine(line, bump = true) {
  const l = { remove: [], adds: [], obs: '', origem: 'cardapio', qty: 1, ...line };
  l.key = lineKey(l);
  const ex = S.cart.find(x => x.key === l.key);
  if (ex) ex.qty += l.qty; else S.cart.push(l);
  saveCart(bump);
}
function saveCart(bump) { store.set('adl2_cart', S.cart); updateTray(bump); refreshBadges(); }
function syncCart() {
  const n = S.cart.length;
  S.cart = S.cart.filter(l => S.byId.get(l.id)?.disponivel);
  if (S.cart.length < n) toast('Um item acabou e saiu da comanda');
  let dropped = false;
  S.cart.forEach(l => { const ok = (l.adds || []).filter(id => S.addById.has(id)); if (ok.length !== (l.adds || []).length) { l.adds = ok; l.key = lineKey(l); dropped = true; } });
  if (dropped) toast('Um adicional acabou e saiu da comanda');
  saveCart();
}
const subtotal = () => S.cart.reduce((s, l) => s + linePrice(l) * l.qty, 0);
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
let lastCount = 0;
function updateTray(bump) {
  const n = count(), f = freteFalta();
  const odo = $('barCount');
  if (n !== lastCount) { odo.innerHTML = `<span>${n}</span>`; odo.classList.remove('roll'); void odo.offsetWidth; odo.classList.add('roll'); lastCount = n; }
  $('trayCount').textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
  $('trayTotal').textContent = short(subtotal());
  $('trayLabel').textContent = f && n ? (f.falta > 0 ? `Faltam ${fmt(f.falta)} p/ frete grátis` : 'Frete grátis garantido') : 'Ver comanda';
  const thumbs = [...new Set(S.cart.map(l => l.id))].map(id => S.byId.get(id)).filter(isLanche).slice(-3);
  $('trayThumbs').innerHTML = thumbs.map(p => `<span>${media(p)}</span>`).join('');
  $('trayThumbs').hidden = !thumbs.length;
  $('tray').classList.toggle('show', n > 0 && !$('sheet').classList.contains('open'));
  if (bump && n) { const t = $('tray'); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
}

// imagem voa até a comanda
function flyToCart(fromEl) {
  if (!fromEl || reduced) return;
  const a = fromEl.getBoundingClientRect();
  const target = $('tray').classList.contains('show') ? $('trayThumbs') : $('barCart');
  const b = target.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'flyer';
  const src = fromEl.querySelector('img, svg, .can');
  fly.innerHTML = src ? src.outerHTML : '';
  const size = Math.min(a.width, a.height, 120);
  Object.assign(fly.style, { left: '0px', top: '0px', width: size + 'px', height: size + 'px' });
  document.body.appendChild(fly);
  const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2;
  const x1 = b.left + b.width / 2 - size / 2, y1 = b.top + b.height / 2 - size / 2;
  const peak = Math.min(y0, y1) - 120;
  fly.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px, ${peak}px) scale(.7) rotate(-8deg)`, opacity: 1, offset: .5 },
    { transform: `translate(${x1}px, ${y1}px) scale(.2) rotate(6deg)`, opacity: .4 },
  ], { duration: 720, easing: 'cubic-bezier(.45, 0, .2, 1)' }).onfinish = () => fly.remove();
}
function quickAdd(id, fromEl) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  if (isDrink(p)) return addDrink(id, 'cardapio', fromEl);
  flyToCart(fromEl);
  addLine({ id, origem: 'cardapio' }, false);
  buzz();
  setTimeout(() => { updateTray(true); afterAdd(p); }, reduced ? 0 : 560);
}
function addDrink(id, origem, fromEl) {
  const p = S.byId.get(id); if (!p?.disponivel) return;
  if (/com ou sem g[aá]s/i.test(p.descricao || '')) return openWater(p, origem);
  addLine({ id, origem }); buzz();
  if ($('sheet').classList.contains('open')) refreshSheet(); else { flyToCart(fromEl); toast(`${p.nome} na comanda`); }
}
function afterAdd(p) {
  if (isLanche(p) && drinksInCart() === 0 && S.drinkAsked < 2) { S.drinkAsked++; setTimeout(() => { if (!$('sheet').classList.contains('open')) openDrinks(p); }, 260); }
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
  setTimeout(updateTray, 250);
}
addEventListener('popstate', () => closeSheet(true));
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('scrim').onclick = () => closeSheet();
$('tray').onclick = () => openReceipt();
$('barCart').onclick = () => openReceipt();

// a foto "cresce" do cartão até o topo da tela do item
function flipFrom(srcEl) {
  const target = $('itMedia');
  if (!srcEl || !target || reduced || !target.querySelector('img')) return;
  const s = srcEl.getBoundingClientRect(), sh = $('sheet').getBoundingClientRect();
  const offset = sh.top - (innerHeight - sh.height);           // quanto o sheet ainda vai subir
  const t = target.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'flyer';
  fly.innerHTML = `<img src="${target.querySelector('img').src}" alt="">`;
  Object.assign(fly.style, { left: s.left + 'px', top: s.top + 'px', width: s.width + 'px', height: s.height + 'px', borderRadius: getComputedStyle(srcEl).borderRadius, boxShadow: 'none' });
  document.body.appendChild(fly);
  target.classList.add('hide-content');
  fly.animate([
    { left: s.left + 'px', top: s.top + 'px', width: s.width + 'px', height: s.height + 'px' },
    { left: t.left + 'px', top: (t.top - offset) + 'px', width: t.width + 'px', height: t.height + 'px', borderRadius: '28px 28px 0 0' },
  ], { duration: 560, easing: OUT, fill: 'forwards' }).onfinish = () => { target.classList.remove('hide-content'); fly.remove(); };
}

// ── Montar o lanche ────────────────────────────────────────
let IT = null;
function openItem(id, srcEl) {
  const p = S.byId.get(id); if (!p) return;
  if (isDrink(p)) return addDrink(id, 'cardapio', srcEl);
  if (!isLanche(p)) return quickAdd(id, srcEl);
  IT = { id, remove: new Set(), adds: [], turbo: false, qty: 1, obs: '', obsOpen: false, show: p.foto_url ? 'photo' : 'inside', anim: 'build', hl: [] };
  openSheet(itemView);
  flipFrom(srcEl);
}
const itShown = () => { const p = S.byId.get(IT.id), up = p.upgrade_para && S.byId.get(p.upgrade_para); return IT.turbo && up?.disponivel ? up : p; };
function itemView() {
  const p = S.byId.get(IT.id), up = p.upgrade_para && S.byId.get(p.upgrade_para), upOk = up?.disponivel, shown = itShown();
  const extra = upOk ? up.ing.filter(i => !p.ing.includes(i)) : [];
  const photo = IT.show === 'photo' && shown.foto_url;
  const chosen = IT.adds.map(id => S.addById.get(id)).filter(Boolean);
  const unit = shown.preco + chosen.reduce((s, x) => s + x.preco, 0);
  const descPlus = [(shown.descricao || '').replace(/\.\s*$/, ''), ...chosen.map(addLayer)].filter(Boolean).join(', ');
  let stage = Stack.svg(descPlus, { removed: [...IT.remove], highlight: IT.hl });
  if (IT.anim === 'build') stage = stage.replace('class="stack', 'class="stack build');
  IT.anim = 'none'; IT.hl = [];
  return `
    <div class="it-media" id="itMedia">
      ${photo ? `<img src="${esc(shown.foto_url)}" alt="${esc(shown.nome)}">` : stage}
      <button class="it-close" onclick="closeSheet()" aria-label="Fechar">✕</button>
      ${shown.foto_url ? `<div class="it-view"><button class="${photo ? 'on' : ''}" onclick="itShow('photo')">Foto</button><button class="${photo ? '' : 'on'}" onclick="itShow('inside')">Por dentro</button></div>` : ''}
    </div>
    <div class="it-head"><h2 class="it-name">${esc(shown.nome)}</h2><span class="it-price">${short(unit)}</span></div>
    ${shown.ing.length ? `<p class="it-label">Toque pra tirar o que não curte</p><div class="chips">${shown.ing.map(i => {
      const k = Stack.keyOf(i) || 'pao';
      return `<button class="chip-i ${k === 'pao' ? 'fixed' : ''} ${IT.remove.has(i) ? 'off' : ''}" style="--c:${Stack.COLOR[k] || '#888'}" data-i="${esc(i)}" onclick="toggleIng(this.dataset.i)"><i></i>${esc(i)}</button>`;
    }).join('')}</div>` : ''}
    ${upOk ? `<button class="turbo ${IT.turbo ? 'on' : ''}" onclick="toggleTurbo()">
      <span class="turbo-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg></span>
      <span class="turbo-txt"><small>Turbina por + ${fmt(up.preco - p.preco)}</small><b>Vira ${esc(up.nome)}</b><span>${extra.length ? 'ganha ' + extra.map(e => '+ ' + esc(e)).join(', ') : 'versão mais caprichada'}</span></span>
      <span class="sw"></span></button>` : ''}
    ${acceptsAdds(shown) && S.adds.length ? `<p class="it-label">Capricha mais · adicionais</p><div class="chips adds">${S.adds.map(x => `<button class="chip-a ${IT.adds.includes(x.id) ? 'on' : ''}" onclick="toggleAdd('${x.id}')"><span>+ ${esc(x.nome)}</span><b>${short(x.preco)}</b></button>`).join('')}</div>` : ''}
    ${IT.obsOpen
      ? `<div class="pad" style="margin-top:16px"><textarea class="field" id="itObs" maxlength="140" placeholder="Ex.: bem passado, molho à parte…" oninput="IT.obs=this.value">${esc(IT.obs)}</textarea></div>`
      : `<button class="obs-link" onclick="IT.obsOpen=true;refreshSheet();setTimeout(()=>$('itObs')?.focus(),60)">+ Alguma observação?</button>`}
    <div class="foot-bar">
      <div class="qty"><button onclick="itQty(-1)" aria-label="Menos">−</button><span>${IT.qty}</span><button onclick="itQty(1)" aria-label="Mais">+</button></div>
      <button class="btn" id="itBtn" onclick="itConfirm()"><span>Adicionar</span><span>${short(unit * IT.qty)}</span></button>
    </div>`;
}
function itShow(v) { IT.show = v; IT.anim = v === 'inside' ? 'build' : 'none'; refreshSheet(); }
async function animateOut(ings) {
  const m = $('itMedia'); if (!m) return;
  let hit = false;
  ings.forEach(i => m.querySelectorAll(`.ly[data-ing="${CSS.escape(i)}"]`).forEach(g => { g.classList.add('out'); hit = true; }));
  if (hit) await wait(280);
}
// mexer nos ingredientes mostra o "por dentro", onde a mudança aparece
async function toggleIng(i) {
  buzz();
  if (IT.show === 'photo') { IT.show = 'inside'; IT.anim = 'none'; }
  if (IT.remove.has(i)) { IT.remove.delete(i); IT.hl = [i]; }
  else { IT.remove.add(i); refreshSheet(); await animateOut([i]); }
  refreshSheet();
}
async function toggleTurbo() {
  const p = S.byId.get(IT.id), up = S.byId.get(p.upgrade_para), extra = up.ing.filter(i => !p.ing.includes(i));
  buzz(15);
  if (!IT.turbo) { IT.turbo = true; IT.hl = extra; if (!up.foto_url) IT.show = 'inside'; }
  else { if (IT.show === 'inside') await animateOut(extra); IT.turbo = false; }
  refreshSheet();
}
// adicional entra no desenho como uma camada nova caindo
async function toggleAdd(id) {
  const x = S.addById.get(id); if (!x) return;
  buzz();
  if (IT.show === 'photo') { IT.show = 'inside'; IT.anim = 'none'; }
  if (IT.adds.includes(id)) { IT.adds = IT.adds.filter(a => a !== id); }
  else { IT.adds.push(id); IT.hl = [addLayer(x)]; }
  refreshSheet();
}
function itQty(d) { IT.qty = Math.max(1, Math.min(20, IT.qty + d)); refreshSheet(); }
async function itConfirm() {
  const p = S.byId.get(IT.id), shown = itShown(), btn = $('itBtn');
  btn.disabled = true; btn.classList.add('done'); btn.innerHTML = '<span>Adicionado ✓</span><span></span>';
  buzz(20);
  flyToCart($('itMedia'));
  addLine({ id: shown.id, qty: IT.qty, remove: [...IT.remove].filter(i => shown.ing.includes(i)), adds: [...IT.adds], obs: (IT.obs || '').trim(), origem: shown === p ? 'cardapio' : 'upgrade' });
  await wait(reduced ? 0 : 520);
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
    return `<div class="up-head"><small>✓ ${p ? esc(p.nome) + ' na comanda' : 'Na comanda'}</small>
        <h3>E pra beber?</h3><p>Prensado pede gelada. Toca pra levar junto.</p></div>
      <div class="fridge up-fridge"><div class="shelf">${upsellDrinks().map(d => bevHTML(d, 'upsell')).join('')}</div></div>
      ${deal ? `<button class="deal" onclick="addDrink('${deal.big.id}','upsell')"><span class="deal-txt"><b>Pra galera: ${esc(deal.big.nome)}</b>${deal.save > 0 ? `sai mais em conta que ${deal.n} latas, <em>economiza ${fmt(deal.save)}</em>` : `dá pra todo mundo por ${fmt(deal.big.preco)}`}</span><span class="deal-add">+ ${short(deal.big.preco)}</span></button>` : ''}
      <div class="actions">
        ${has ? `<button class="btn" onclick="openReceipt()"><span>Ver comanda</span><span>${short(subtotal())}</span></button>` : ''}
        <button class="btn ${has ? 'light' : 'ghost'} center" onclick="closeSheet()">${has ? 'Continuar escolhendo' : 'Agora não'}</button>
      </div>`;
  });
}
function openWater(p, origem) {
  openSheet(() => `<div class="up-head"><small>${esc(p.nome)}</small><h3>Com ou sem gás?</h3></div>
    <div class="actions">
      <button class="btn center" onclick="addLine({id:'${p.id}',obs:'Sem gás',origem:'${origem}'});buzz();toast('Água na comanda');closeSheet()">Sem gás</button>
      <button class="btn light center" onclick="addLine({id:'${p.id}',obs:'Com gás',origem:'${origem}'});buzz();toast('Água na comanda');closeSheet()">Com gás</button>
    </div>`);
}

// ── Comanda ────────────────────────────────────────────────
const lineObs = l => [l.remove?.length ? 'SEM ' + l.remove.join(', ') : '', l.obs].filter(Boolean).join(' · ');
const lineAdds = l => addsOf(l).map(x => '+ ' + x.nome).join(', ');
function suggestions() {
  const out = [];
  if (drinksInCart() === 0) {
    const d = upsellDrinks().slice(0, 4);
    if (d.length) out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Faltou a bebida</b>Um toque e vai junto.</div>
      <div class="rc-mini">${d.map(x => `<button onclick="addLine({id:'${x.id}',origem:'bump'});buzz();refreshSheet()">${esc(bevLook(x).label)} lata · ${short(x.preco)}</button>`).join('')}</div></div>`);
  }
  const cand = S.cart.find(l => { const p = S.byId.get(l.id), u = p?.upgrade_para && S.byId.get(p.upgrade_para); return l.origem !== 'upgrade' && isLanche(p) && u?.disponivel; });
  if (cand) {
    const p = S.byId.get(cand.id), u = S.byId.get(p.upgrade_para), extra = u.ing.filter(i => !p.ing.includes(i));
    out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Turbina o ${esc(p.nome)}?</b>Vira ${esc(u.nome)}${extra.length ? ' (+ ' + esc(extra.join(', ')) + ')' : ''} por + ${fmt(u.preco - p.preco)}${cand.qty > 1 ? ' cada' : ''}.</div>
      <button class="rc-sug-btn" onclick="upgradeLine('${cand.key}')">Turbinar</button></div>`);
  }
  const molho = findProd(/^molho verde/i);
  if (molho && lanchesInCart() > 0 && !S.cart.some(l => isMolho(S.byId.get(l.id))))
    out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Molho verde da casa?</b>O sachê de 20g sai por ${fmt(molho.preco)}.</div><button class="rc-sug-btn" onclick="addLine({id:'${molho.id}',origem:'bump'});buzz();refreshSheet()">+ ${short(molho.preco)}</button></div>`);
  const deal = familyDeal();
  if (deal && drinksInCart() > 0 && out.length < 2) out.push(`<div class="rc-sug"><div class="rc-sug-txt"><b>Pra galera</b>${esc(deal.big.nome)} por ${fmt(deal.big.preco)}.</div><button class="rc-sug-btn" onclick="addLine({id:'${deal.big.id}',origem:'bump'});buzz();refreshSheet()">+ Levar</button></div>`);
  return out.slice(0, 2).join('');
}
function upgradeLine(key) {
  const l = S.cart.find(x => x.key === key); if (!l) return;
  const p = S.byId.get(l.id), u = S.byId.get(p.upgrade_para);
  S.cart = S.cart.filter(x => x !== l);
  addLine({ id: u.id, qty: l.qty, remove: (l.remove || []).filter(i => u.ing.includes(i)), adds: l.adds || [], obs: l.obs, origem: 'upgrade' });
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
        const ad = lineAdds(l);
        return `<div class="rc-item"><div class="rc-thumb">${media(p)}</div>
          <div class="rc-name">${l.qty}x ${esc(p.nome)}</div><div class="rc-price">${fmt(linePrice(l) * l.qty)}</div>
          ${ad ? `<div class="rc-adds">${esc(ad)}</div>` : ''}${o ? `<div class="rc-obs">${esc(o)}</div>` : ''}
          <div class="rc-ctrl"><button onclick="changeLine('${l.key}',-1)" aria-label="Menos">−</button><span>${l.qty}</span><button onclick="changeLine('${l.key}',1)" aria-label="Mais">+</button><span class="unit">${fmt(linePrice(l))} un.</span></div></div>`; }).join('')}
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
  const pixNote = c.chave_pix ? 'Logo depois de fazer o pedido aparece o QR e o copia e cola com o valor certinho. Pagou, é só mandar o comprovante no WhatsApp com um toque.' : 'Paga no PIX na hora da entrega ou da retirada.';
  return `<div class="co dark">
      <button class="co-back" onclick="openReceipt()">← Voltar pra comanda</button>
      <h3>Quase lá</h3>
      ${st.open ? '' : `<div class="closed">${esc(st.text)}. Sua comanda fica salva até abrir.</div>`}
      <div class="co-sec"><span class="co-label">Quem tá pedindo</span>
        <input class="field" id="coNome" autocomplete="name" placeholder="Seu nome" value="${esc(cli.nome || '')}">
        <input class="field" id="coTel" type="tel" inputmode="numeric" autocomplete="tel" placeholder="WhatsApp com DDD" value="${esc(cli.tel || '')}" oninput="this.value=maskTel(this.value)"></div>
      <div class="co-sec"><span class="co-label">Como recebe</span>
        <div class="modes" style="margin:0">
          <button class="seg ${S.mode === 'delivery' ? 'on' : ''}" onclick="keepForm();setMode('delivery')">Entrega<small>+ ${short(c.taxa_entrega || 0)}</small></button>
          <button class="seg ${S.mode === 'retirada' ? 'on' : ''}" onclick="keepForm();setMode('retirada')">Retirada<small>sem taxa</small></button>
        </div>
        ${S.mode === 'delivery' ? `<div class="co-grid"><input class="field" id="coRua" autocomplete="address-line1" placeholder="Rua / Avenida" value="${esc(cli.rua || '')}"><input class="field" id="coNum" inputmode="numeric" placeholder="Nº" value="${esc(cli.numero || '')}"></div>
          <input class="field" id="coBairro" placeholder="Bairro" value="${esc(cli.bairro || '')}">
          <input class="field" id="coComp" placeholder="Complemento / referência" value="${esc(cli.comp || '')}">`
        : `<div class="note">Retire em <b>${esc(c.endereco || '')}</b></div>`}</div>
      <div class="co-sec"><span class="co-label">Pagamento</span>
        <div class="pays">${formas.map(f => `<button class="seg ${S.pay === f ? 'on' : ''}" onclick="keepForm();S.pay='${f}';refreshSheet()">${label[f]}</button>`).join('')}</div>
        ${S.pay === 'dinheiro' ? `<input class="field" id="coTroco" inputmode="decimal" placeholder="Troco pra quanto? (opcional)" value="${esc(cli.troco || '')}">` : ''}
        ${S.pay === 'pix' ? `<div class="note">${pixNote}</div>` : ''}
        ${S.pay === 'cartao' ? `<div class="note">A maquininha vai até você (ou fica no balcão).</div>` : ''}</div>
      <div class="co-sec"><span class="co-label">Observação do pedido</span>
        <textarea class="field" id="coObs" maxlength="300" placeholder="Opcional">${esc(cli.obsPedido || '')}</textarea></div>
      <div class="co-sum">
        <div class="rc-row"><span>${count()} ${count() === 1 ? 'item' : 'itens'}</span><span>${fmt(subtotal())}</span></div>
        <div class="rc-row"><span>${S.mode === 'delivery' ? 'Entrega' : 'Retirada'}</span><span class="${taxa() ? '' : 'free'}">${taxa() ? fmt(taxa()) : 'grátis'}</span></div>
        <div class="rc-row total"><span>TOTAL</span><span>${fmt(total())}</span></div>
      </div>
      <p class="err" id="coErr"></p>
    </div>
    <div class="foot-bar"><button class="btn" id="coBtn" onclick="placeOrder()" ${st.open ? '' : 'disabled'}><span>${st.open ? 'Fazer pedido' : 'Loja fechada'}</span><span>${short(total())}</span></button></div>`;
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
  const itens = S.cart.map(l => ({ produto_id: l.id, quantidade: l.qty, adicionais: l.adds || [], observacao: lineObs(l) || null, origem: l.origem }));
  const { data, error } = await supa.rpc('criar_pedido', { p_loja_slug: LOJA_SLUG, p_pedido: pedido, p_itens: itens });
  if (error) { btn.disabled = false; btn.firstElementChild.textContent = 'Fazer pedido'; return err(error.message || 'Não deu pra enviar. Tenta de novo?'); }
  store.set('adl_cliente', { ...cli, mode: S.mode, pay: S.pay, obsPedido: '' });
  store.set('adl_ultimo', { at: Date.now(), itens: S.cart.map(l => ({ id: l.id, qty: l.qty, remove: l.remove, adds: l.adds, obs: l.obs })), total: data.total });
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
  const sent = TD.pix_informado;
  return `<div class="pix">
    <ol class="pix-steps"><li class="${sent ? 'ok' : 'now'}">Paga</li><li class="${sent ? 'now' : ''}">Manda o comprovante</li><li>A loja confirma</li></ol>
    ${sent ? '' : `<h4>Paga no PIX agora</h4><p>Escaneia o QR ou copia o código. O valor já vem certinho.</p>
    <div class="pix-qr">${Pix.qrSVG(code)}</div>`}
    <div class="pix-val">${fmt(TD.total || 0)}</div>
    <p class="pix-to">Para <b>${esc(S.loja.nome)}</b> · chave ${esc(pixKeyLabel(c.chave_pix))}</p>
    <button class="btn light center" onclick="copyPix(this)" data-code="${esc(code)}">Copiar código PIX</button>
    ${sent
      ? `<span class="pix-ok pix-wait">Comprovante enviado. Assim que a loja conferir, aparece "confirmado" aqui.</span>
         <button class="pix-link" onclick="sendProof(true)">Abrir o WhatsApp de novo</button>`
      : `<button class="btn wa center" style="margin-top:10px;width:100%" onclick="sendProof()">${WA_ICON} Já paguei · enviar comprovante</button>
         <p class="pix-hint">Abre o WhatsApp da loja com o número do pedido. É só anexar o print do PIX.</p>`}
  </div>`;
}
const WA_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.8.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>';
// chave de celular (+55...) aparece formatada; as outras, como estão
const pixKeyLabel = k => String(k || '').startsWith('+55') ? telBR(k) : k;
// marca o pedido como "comprovante enviado" e abre o WhatsApp da loja com a mensagem pronta
async function sendProof(again = false) {
  const c = S.loja.config || {};
  const num = '#' + String(TD.numero).padStart(3, '0');
  const msg = `Oi! Paguei o PIX do pedido ${num} (${fmt(TD.total || 0)}). Segue o comprovante:`;
  if (c.whatsapp) window.open(`https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  if (!again && !TD.pix_informado) { await supa.rpc('informar_pix', { p_token: trackToken }); TD.pix_informado = true; refreshSheet(); renderLive(); }
  buzz();
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
  const steps = [['1', 'Pedido recebido'], ['2', 'Na chapa'], ['3', ret ? 'Pronto pra retirar' : 'Saiu pra entrega'], ['4', ret ? 'Retirado' : 'Entregue']];
  const cur = { novo: 0, preparo: 1, pronto: 2, entrega: 2, finalizado: 3 }[d.status] ?? 0;
  const num = '#' + String(d.numero).padStart(3, '0');
  if (d.status === 'cancelado') return `<div class="track"><div class="stamp" style="border-color:var(--muted);color:var(--muted)">Cancelado<small>${num}</small></div><p>A loja cancelou esse pedido.${S.loja?.config?.whatsapp ? ` <a href="https://wa.me/${esc(S.loja.config.whatsapp)}" target="_blank" rel="noopener" style="color:var(--yellow)">Chama no WhatsApp</a> se tiver dúvida.` : ''}</p><div class="actions"><button class="btn center" onclick="clearActive();closeSheet()">Fechar</button></div></div>`;
  return `<div class="track">
    <div class="stamp" ${d.fresh ? '' : 'style="animation:none"'}>${cur >= 3 ? 'Entregue' : 'Recebido'}<small>pedido ${num}</small></div>
    <p>${cur >= 3 ? 'Valeu demais. Bom apetite!' : 'Pode fechar: o status aparece aqui em cima.'}</p>
    ${pixHTML()}
    <ol class="steps">${steps.map(([n, txt], i) => `<li class="${i < cur || cur === 3 ? 'done' : i === cur ? 'now' : ''}"><i>${i < cur || cur === 3 ? '✓' : n}</i>${txt}</li>`).join('')}</ol>
    ${d.itens?.length ? `<div class="track-items">${d.itens.map(i => `${i.qtd}x ${esc(i.nome)}`).join('<br>')}<br><b>total ${fmt(d.total)}</b></div>` : ''}
    <div class="actions"><button class="btn ${cur >= 3 ? '' : 'light'} center" onclick="${cur >= 3 ? 'clearActive();' : ''}closeSheet()">${cur >= 3 ? 'Fechar' : 'Voltar pro cardápio'}</button></div>
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
// a entrada só começa quando a foto do hero estiver pronta (ou em 1,4s)
function ready() {
  if (document.body.classList.contains('ready')) return;
  const img = $('heroImg');
  const go = () => document.body.classList.add('ready');
  if (img.complete && img.naturalWidth) return go();
  img.addEventListener('load', go, { once: true });
  setTimeout(go, 1400);
}
(async function init() {
  const cache = store.get('adl2_menu');
  if (cache?.loja) { applyMenu(cache.loja, cache.cats || [], cache.prods || [], cache.adds || []); syncCart(); renderAll(); ready(); }
  try {
    await Promise.all([loadMenu(), loadSocial()]);
    syncCart(); renderAll(); ready(); subscribe(); checkActive();
    setInterval(renderStatus, 60000);
  } catch (e) {
    console.error(e); ready();
    if (!cache) $('menu').innerHTML = '<div class="empty" style="padding:60px 16px"><b>Sem conexão</b><p>Recarrega em alguns segundos.</p></div>';
  }
})();

Object.assign(window, {
  openItem, quickAdd, addDrink, goCat, repeatLast, closeSheet, refreshSheet, itShow, toggleIng, toggleTurbo, itQty, itConfirm,
  openReceipt, openCheckout, changeLine, upgradeLine, setMode, keepForm, placeOrder, maskTel, addLine, buzz, toast,
  copyPix, informarPix, clearActive, toggleAdd, sendProof,
});
