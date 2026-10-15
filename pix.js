// ═══════════════════════════════════════════════════════════
//  PIX — gera o código "copia e cola" (BR Code estático do
//  Banco Central) com o valor exato do pedido. Sem gateway e sem
//  taxa: o dinheiro cai direto na chave da loja.
// ═══════════════════════════════════════════════════════════
'use strict';

const Pix = (() => {
  const field = (id, value) => id + String(value.length).padStart(2, '0') + value;

  // CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido pelo padrão EMV
  function crc16(str) {
    let crc = 0xFFFF;
    for (const ch of new TextEncoder().encode(str)) {
      crc ^= ch << 8;
      for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Normaliza a chave como o Banco Central espera
  function normalizeKey(key) {
    const k = String(key || '').trim();
    if (!k) return '';
    if (k.includes('@')) return k.toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
    if (k.startsWith('+')) return '+' + k.replace(/\D/g, '');
    const d = k.replace(/\D/g, '');
    if (d.length === 14 || d.length === 11) return d;         // CNPJ ou CPF
    if (d.length === 12 || d.length === 13) return '+' + d;   // celular já com 55
    return k;
  }

  // Remove acento e limita, porque nome e cidade só aceitam ASCII
  const ascii = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max);

  function code({ key, name, city, amount, txid }) {
    const gui = field('00', 'br.gov.bcb.pix') + field('01', normalizeKey(key));
    let payload =
      field('00', '01') +
      field('26', gui) +
      field('52', '0000') +
      field('53', '986') +
      (amount ? field('54', Number(amount).toFixed(2)) : '') +
      field('58', 'BR') +
      field('59', ascii(name, 25) || 'LOJA') +
      field('60', ascii(city, 15) || 'BRASIL') +
      field('62', field('05', (String(txid || '***').replace(/[^A-Za-z0-9]/g, '') || '***').slice(0, 25)));
    payload += '6304';
    return payload + crc16(payload);
  }

  // SVG do QR (usa qrcode-generator)
  function qrSVG(text) {
    if (typeof qrcode !== 'function') return '';
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  return { code, qrSVG, normalizeKey };
})();
