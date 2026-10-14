// ═══════════════════════════════════════════════════════════
//  STACK — desenha cada lanche em corte lateral, camada por
//  camada, a partir dos ingredientes da descrição do produto.
//  Mesmo traço da logo: contorno grosso, cor chapada.
// ═══════════════════════════════════════════════════════════
'use strict';

const Stack = (() => {
  const INK = '#2A1710';
  const W = 300, L = 30, R = 270; // largura útil do pão

  // gerador determinístico (mesmo lanche = mesmo desenho)
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  // ── Ingredientes reconhecidos (ordem = de baixo pra cima) ──
  const ORDER = ['alface', 'tomate', 'grao', 'burger', 'picanha', 'frango', 'salsicha', 'calabresa', 'presunto', 'mussarela', 'cheddar', 'catupiry', 'bacon', 'ovo', 'milho', 'batata'];
  const LABEL = {
    alface: 'alface', tomate: 'tomate', grao: 'burger de grão-de-bico', burger: 'hambúrguer', picanha: 'picanha', frango: 'frango',
    salsicha: 'salsicha', calabresa: 'calabresa', presunto: 'presunto', mussarela: 'mussarela', cheddar: 'cheddar', catupiry: 'catupiry',
    bacon: 'bacon', ovo: 'ovo', milho: 'milho', batata: 'batata palha',
  };
  // cor-assinatura de cada ingrediente (usada nos chips)
  const COLOR = {
    alface: '#6CBF3A', tomate: '#E63A2E', grao: '#C9A15A', burger: '#6B3A22', picanha: '#9A3F2C', frango: '#E8BB7E', salsicha: '#D9634B',
    calabresa: '#B8332A', presunto: '#F2A1A1', mussarela: '#FFD86B', cheddar: '#FF9F1C', catupiry: '#FFF4DE', bacon: '#B4412F', ovo: '#FFB703',
    milho: '#FFD23F', batata: '#F4B942', pao: '#E9A54B',
  };
  function keyOf(ing) {
    const s = ing.toLowerCase();
    if (/gr[aã]o/.test(s)) return 'grao';
    if (/hamb[uú]rguer/.test(s)) return 'burger';
    if (/picanha/.test(s)) return 'picanha';
    if (/frango/.test(s)) return 'frango';
    if (/salsicha/.test(s)) return 'salsicha';
    if (/calabresa/.test(s)) return 'calabresa';
    if (/bacon/.test(s)) return 'bacon';
    if (/presunto/.test(s)) return 'presunto';
    if (/mussarela|muçarela|queijo/.test(s)) return 'mussarela';
    if (/cheddar/.test(s)) return 'cheddar';
    if (/catupiry|requeij/.test(s)) return 'catupiry';
    if (/ovo/.test(s)) return 'ovo';
    if (/tomate/.test(s)) return 'tomate';
    if (/alface/.test(s)) return 'alface';
    if (/milho/.test(s)) return 'milho';
    if (/batata/.test(s)) return 'batata';
    if (/p[aã]o/.test(s)) return 'pao';
    return null;
  }
  const countOf = ing => { const m = ing.match(/^(\d+)\s/); return m ? Math.min(3, +m[1]) : 1; };

  // ── Primitivas ─────────────────────────────────────────────
  const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  // ondinha de x0 até ~x1
  function wave(y, amp, step, x0 = L, x1 = R) {
    let d = '';
    for (let x = x0, k = 0; x <= x1; x += step, k++) d += ` Q ${x + step / 2} ${y + (k % 2 ? amp : -amp)} ${x + step} ${y}`;
    return d;
  }
  // queijo derretido escorrendo pelas bordas
  function cheese(y, r, fill, drip, xs, th = 11) {
    let d = `M ${L - 6} ${y} Q ${W / 2} ${y - 3} ${R + 6} ${y} L ${R + 4} ${y + th}`;
    [...xs].sort((a, b) => b - a).forEach(x => {
      const len = drip * .6 + r() * drip;
      d += ` H ${x + 11} V ${y + th + len} Q ${x + 5.5} ${y + th + 7 + len} ${x} ${y + th + len} V ${y + th}`;
    });
    return `<path d="${d} H ${L - 4} Z" fill="${fill}" ${S}/><path d="M ${L + 10} ${y + 4} H ${L + 60}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
  }
  const scatter = (r, n, fn) => { let o = ''; for (let i = 0; i < n; i++) o += fn(i); return o; };

  // ── Camadas: { h, draw(y, r) } — y é o topo da camada ──────
  const LAYERS = {
    paoBase: { h: 28, draw: y => `
      <path d="M ${L - 2} ${y} H ${R + 2} Q ${R + 10} ${y} ${R + 6} ${y + 13} Q ${R} ${y + 28} ${R - 20} ${y + 28} H ${L + 20} Q ${L} ${y + 28} ${L - 6} ${y + 13} Q ${L - 10} ${y} ${L - 2} ${y} Z" fill="#DE9640" ${S}/>
      <path d="M ${L + 16} ${y + 19} H ${R - 16}" stroke="#B9732C" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>` },

    paoTopo: { h: 42, draw: y => {
      const marks = scatter(null, 9, i => `<path d="M ${L + 20 + i * 27} ${y + 10} l 15 22" stroke="#8B4A16" stroke-width="5" stroke-linecap="round" opacity=".75"/>`);
      return `<path d="M ${L - 6} ${y + 38} Q ${L - 12} ${y + 8} ${L + 20} ${y + 3} Q ${W / 2} ${y - 7} ${R - 20} ${y + 3} Q ${R + 12} ${y + 8} ${R + 6} ${y + 38} Z" fill="#E9A54B" ${S}/>
        ${marks}<path d="M ${L + 16} ${y + 11} Q ${W / 2} ${y + 1} ${R - 50} ${y + 9}" stroke="#FFE2A8" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>`;
    } },

    alface: { h: 16, draw: y => `
      <path d="M ${L - 18} ${y + 10}${wave(y + 9, 8, 16, L - 18, R + 2)} L ${R + 18} ${y + 16} L ${L - 18} ${y + 16} Z" fill="#6CBF3A" ${S}/>
      <path d="M ${L + 6} ${y + 12} Q ${W / 2} ${y + 6} ${R - 6} ${y + 12}" stroke="#3F8F24" stroke-width="3" fill="none" stroke-linecap="round"/>` },

    tomate: { h: 16, draw: y => [[L - 2, 82], [L + 84, 84], [L + 172, 76]].map(([x, w]) =>
      `<rect x="${x}" y="${y}" width="${w}" height="16" rx="8" fill="#E63A2E" ${S}/>` +
      [1, 2, 3].map(i => `<ellipse cx="${x + i * w / 4}" cy="${y + 8}" rx="3.5" ry="2.5" fill="#FFD7B5"/>`).join('')).join('') },

    burger: { h: 30, draw: (y, r) => {
      let bumps = ''; for (let x = L + 4; x < R - 6; x += 18) bumps += ` Q ${x + 9} ${y - 3 - r() * 4} ${x + 18} ${y}`;
      const dots = scatter(r, 18, () => `<circle cx="${L + 16 + r() * (R - L - 32)}" cy="${y + 7 + r() * 16}" r="${1.6 + r() * 1.8}" fill="#3E1E10"/>`);
      return `<path d="M ${L + 2} ${y + 28} Q ${L - 6} ${y + 12} ${L + 4} ${y}${bumps} Q ${R + 8} ${y + 12} ${R - 2} ${y + 28} Z" fill="#6B3A22" ${S}/>${dots}`;
    } },

    grao: { h: 26, draw: (y, r) => `<rect x="${L}" y="${y}" width="${R - L}" height="25" rx="12" fill="#C9A15A" ${S}/>` +
      scatter(r, 22, () => `<circle cx="${L + 14 + r() * (R - L - 28)}" cy="${y + 6 + r() * 14}" r="${2.2 + r() * 1.6}" fill="#A07B38"/>`) },

    picanha: { h: 26, draw: y => `
      <path d="M ${L + 2} ${y + 25} Q ${L - 4} ${y + 4} ${L + 16} ${y + 3} H ${R - 16} Q ${R + 4} ${y + 4} ${R - 2} ${y + 25} Z" fill="#9A3F2C" ${S}/>
      <path d="M ${L + 12} ${y + 6} H ${R - 12}" stroke="#F3D3B5" stroke-width="6" stroke-linecap="round"/>` +
      scatter(null, 8, i => `<path d="M ${L + 22 + i * 30} ${y + 11} l 13 11" stroke="#5A2015" stroke-width="4" stroke-linecap="round"/>`) },

    frango: { h: 22, draw: (y, r) => `<path d="M ${L} ${y + 21} L ${L + 4} ${y + 6}${wave(y + 5, 4, 20, L + 4, R - 24)} L ${R} ${y + 21} Z" fill="#E8BB7E" ${S}/>` +
      scatter(r, 20, () => { const x = L + 6 + r() * (R - L - 30); return `<path d="M ${x} ${y + 5 + r() * 12} q 9 ${-4 + r() * 8} 20 ${-2 + r() * 4}" stroke="#B9824A" stroke-width="3" fill="none" stroke-linecap="round"/>`; }) },

    salsicha: { h: 28, draw: y => { const n = 5, w = (R - L + 10) / n;
      return scatter(null, n, i => { const cx = L - 5 + w * i + w / 2;
        return `<ellipse cx="${cx}" cy="${y + 14}" rx="${w / 2}" ry="13" fill="#D9634B" ${S}/><path d="M ${cx - w / 4} ${y + 8} q ${w / 4} -4 ${w / 2.3} 0" stroke="#F4A58F" stroke-width="3" fill="none" stroke-linecap="round"/>`; }); } },

    calabresa: { h: 20, draw: (y, r) => { const n = 6, w = (R - L + 10) / n;
      return scatter(r, n, i => { const cx = L - 5 + w * i + w / 2;
        return `<ellipse cx="${cx}" cy="${y + 10}" rx="${w / 2 + 2}" ry="9.5" fill="#B8332A" ${S}/>` +
          scatter(r, 4, () => `<circle cx="${cx - 12 + r() * 24}" cy="${y + 6 + r() * 8}" r="2" fill="#F08A6E"/>`); }); } },

    presunto: { h: 13, draw: y => `<path d="M ${L - 4} ${y + 10} L ${L} ${y + 4}${wave(y + 4, 3.5, 24, L, R - 24)} L ${R + 4} ${y + 10} Q ${W / 2} ${y + 15} ${L - 4} ${y + 10} Z" fill="#F2A1A1" ${S}/>` },

    mussarela: { h: 12, draw: (y, r) => cheese(y, r, '#FFD86B', 9, [L + 30 + r() * 30, W / 2 + r() * 30, R - 50 - r() * 20]) },
    cheddar: { h: 12, draw: (y, r) => cheese(y, r, '#FF9F1C', 16, [L + 20 + r() * 30, L + 100 + r() * 20, R - 60 + r() * 20]) },

    catupiry: { h: 18, draw: y => { let d = `M ${L} ${y + 18}`; for (let x = L; x < R - 4; x += 30) d += ` q 6 -20 15 -14 q 9 -10 15 14`;
      return `<path d="${d} Z" fill="#FFF4DE" ${S}/><path d="M ${L + 10} ${y + 8} q 5 -4 9 0 M ${W / 2 + 4} ${y + 7} q 5 -4 9 0 M ${R - 40} ${y + 8} q 5 -4 9 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`; } },

    bacon: { h: 20, draw: y => {
      const strip = (yy, x0, x1) => `<path d="M ${x0} ${yy + 2}${wave(yy + 2, 5, 22, x0, x1 - 22)} L ${x1} ${yy + 13} Q ${(x0 + x1) / 2} ${yy + 20} ${x0} ${yy + 13} Z" fill="#B4412F" ${S}/>` +
        `<path d="M ${x0 + 10} ${yy + 8} Q ${(x0 + x1) / 2} ${yy + 3} ${x1 - 10} ${yy + 8}" stroke="#F2B49B" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      return strip(y, L - 8, W / 2 + 8) + strip(y + 3, W / 2 - 8, R + 8);
    } },

    ovo: { h: 20, draw: y => `
      <path d="M ${L + 10} ${y + 19} Q ${L - 6} ${y + 8} ${L + 26} ${y + 4} Q ${W / 2} ${y - 6} ${R - 26} ${y + 4} Q ${R + 6} ${y + 8} ${R - 10} ${y + 19} Z" fill="#FFFDF5" ${S}/>
      <ellipse cx="${W / 2}" cy="${y + 8}" rx="32" ry="10" fill="#FFB703" ${S}/><path d="M ${W / 2 - 16} ${y + 4} q 9 -4 16 0" stroke="#FFE08A" stroke-width="3" fill="none" stroke-linecap="round"/>` },

    milho: { h: 12, draw: (y, r) => scatter(r, 22, () => { const x = L + 4 + r() * (R - L - 14), yy = y + 1 + r() * 6;
      return `<rect x="${x}" y="${yy}" width="11" height="9" rx="3.5" fill="#FFD23F" stroke="${INK}" stroke-width="2" transform="rotate(${-20 + r() * 40} ${x + 5} ${yy + 4})"/>`; }) },

    batata: { h: 16, draw: (y, r) => scatter(r, 54, () => {
      const x = L - 10 + r() * (R - L + 8), yy = y + 3 + r() * 11, a = (-40 + r() * 80) * Math.PI / 180, len = 14 + r() * 16;
      const color = r() > .5 ? '#F4B942' : '#E39A2A';
      return `<path d="M ${x} ${yy} l ${(Math.cos(a) * len).toFixed(1)} ${(Math.sin(a) * len * .35).toFixed(1)}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`; }) },

    generico: { h: 24, draw: y => `<rect x="${L}" y="${y}" width="${R - L}" height="22" rx="11" fill="#D9634B" ${S}/>` },
  };

  // ── Transforma uma descrição em lista de camadas ───────────
  function layersFor(desc, removed = []) {
    const ings = (desc || '').replace(/\.\s*$/, '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(Boolean);
    const found = [];
    ings.forEach(ing => {
      const k = keyOf(ing);
      if (!k || k === 'pao' || removed.includes(ing.toLowerCase())) return;
      for (let i = 0; i < countOf(ing); i++) found.push({ k, ing: ing.toLowerCase(), dup: i });
    });
    found.sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k));
    if (!found.length) found.push({ k: 'generico', ing: '', dup: 0 });
    return found;
  }

  // ── Monta o SVG. opts: { exploded, gap, labels, removed[], highlight[] } ──
  function svg(desc, opts = {}) {
    const list = [{ k: 'paoBase', ing: 'pão' }, ...layersFor(desc, opts.removed || []), { k: 'paoTopo', ing: 'pão' }];
    const r = rng(hash(desc || 'x'));
    const gap = opts.exploded ? (opts.gap ?? 26) : 0;
    const total = list.reduce((s, l) => s + LAYERS[l.k].h, 0);
    const H = total + 44 + gap * (list.length - 1);
    let y = H - 16, out = '', labels = '';
    list.forEach((l, i) => {
      const ly = LAYERS[l.k];
      y -= ly.h;
      const hl = (opts.highlight || []).includes(l.ing) ? ' hl' : '';
      let lb = '';
      if (opts.labels && !(l.k === 'paoBase') && !(l.dup > 0)) {
        const ty = y + ly.h / 2;
        const text = l.k === 'paoTopo' ? 'pão na chapa' : LABEL[l.k] || l.ing;
        lb = `<g class="lb"><path d="M ${R + 16} ${ty} H ${W + 34}" stroke="currentColor" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round" fill="none"/>
          <circle cx="${R + 14}" cy="${ty}" r="3" fill="currentColor"/><text x="${W + 40}" y="${ty + 6}">${text}</text></g>`;
      }
      out += `<g class="ly${hl}" style="--i:${i};--n:${list.length}" data-ing="${l.ing}"><g class="ly-in">${ly.draw(y, r)}</g>${lb}</g>`;
      y -= gap;
    });
    const vbX = opts.labels ? -14 : -14, vbW = opts.labels ? W + 210 : W + 28;
    return `<svg class="stack${opts.exploded ? ' exploded' : ''}" viewBox="${vbX} 0 ${vbW} ${H}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <ellipse class="stack-shadow" cx="${W / 2}" cy="${H - 10}" rx="${W / 2}" ry="10" fill="rgba(0,0,0,.4)"/>
      ${out}${labels}</svg>`;
  }

  return { svg, layersFor, keyOf, COLOR, LABEL, ingredientsOf: desc => (desc || '').replace(/\.\s*$/, '').split(/,\s*|\s+e\s+/).map(s => s.trim().toLowerCase()).filter(Boolean) };
})();
