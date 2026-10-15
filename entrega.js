// ═══════════════════════════════════════════════════════════
//  ENTREGA + COMPROVANTE
//  · Distância loja → cliente (GPS do celular ou endereço no mapa
//    do OpenStreetMap) e taxa conforme o raio configurado no painel.
//  · Envio do comprovante PIX para o bucket privado do Supabase.
//  O banco recalcula a taxa no criar_pedido; aqui é só pra mostrar.
// ═══════════════════════════════════════════════════════════
'use strict';

const Entrega = (() => {
  // linha reta em km (mesma fórmula do public.distancia_km)
  function km(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
  }
  const store = cfg => cfg?.loja_lat != null && cfg?.loja_lng != null ? { lat: Number(cfg.loja_lat), lng: Number(cfg.loja_lng) } : null;
  const enabled = cfg => !!store(cfg) && cfg?.entrega_raio_km != null && cfg?.taxa_entrega_longe != null;

  // taxa para uma posição (sem posição = taxa base)
  function fee(cfg, geo) {
    const base = Number(cfg?.taxa_entrega || 0);
    const loja = store(cfg);
    if (!geo || !loja) return { taxa: base, km: null };
    const d = km(loja, geo);
    const longe = enabled(cfg) && d > Number(cfg.entrega_raio_km);
    return { taxa: longe ? Number(cfg.taxa_entrega_longe) : base, km: d, longe };
  }

  // GPS do celular (preciso quando o cliente está em casa)
  function gps() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('Seu navegador não libera a localização'));
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude, fonte: 'gps', precisao: Math.round(p.coords.accuracy) }),
        e => rej(new Error(e.code === 1 ? 'Localização bloqueada. Libere nas configurações ou digite o endereço.' : 'Não deu pra pegar sua localização agora.')),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  // endereço digitado → posição aproximada (OpenStreetMap, só na região da loja)
  const cache = {};
  async function geocode(cfg, { rua, numero, bairro }) {
    const loja = store(cfg); if (!loja || !rua) return null;
    const key = [rua, numero, bairro].join('|').toLowerCase().trim();
    if (key in cache) return cache[key];
    const d = .1; // ~11 km em volta da loja
    const vb = `${loja.lng - d},${loja.lat + d},${loja.lng + d},${loja.lat - d}`;
    const city = (cfg.endereco || '').match(/,\s*([^,/]+)\s*\/\s*([A-Z]{2})\s*$/)?.[1] || 'Umuarama';
    const tries = [`street=${encodeURIComponent(`${numero || ''} ${rua}`.trim())}&city=${encodeURIComponent(city)}`];
    if (bairro) tries.push(`q=${encodeURIComponent(`${rua}, ${bairro}, ${city}`)}`);
    for (const t of tries) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&viewbox=${vb}&bounded=1&${t}`, { headers: { 'Accept-Language': 'pt-BR' } });
        const j = await r.json();
        if (j[0]) return (cache[key] = { lat: +j[0].lat, lng: +j[0].lon, fonte: 'endereco' });
      } catch {}
    }
    return (cache[key] = null);
  }
  return { km, fee, gps, geocode, enabled };
})();

const Comprovante = (() => {
  // foto vira JPEG leve (até 1600px); PDF vai como está
  function shrink(file) {
    if (!/^image\//.test(file.type) || /heic|heif/.test(file.type)) return Promise.resolve(file);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => res(b || file), 'image/jpeg', .85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }
  async function enviar(supa, slug, token, file) {
    if (file.size > 12 * 1024 * 1024) throw new Error('Arquivo grande demais. Manda um print da tela do banco.');
    const blob = await shrink(file);
    const type = blob.type || file.type || 'image/jpeg';
    const ext = type === 'application/pdf' ? 'pdf' : type.includes('png') ? 'png' : type.includes('heic') || type.includes('heif') ? 'heic' : 'jpg';
    const path = `${slug}/${token}/${Date.now()}.${ext}`;
    const { error } = await supa.storage.from('comprovantes').upload(path, blob, { contentType: type, upsert: false });
    if (error) throw new Error('Não deu pra enviar o comprovante. Tenta de novo?');
    const { error: e2 } = await supa.rpc('registrar_comprovante', { p_token: token, p_path: path });
    if (e2) throw new Error(e2.message || 'Não deu pra registrar o comprovante.');
    return path;
  }
  return { enviar };
})();
