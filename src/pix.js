// PIX BR Code (EMV/Bacen) + CRC16-CCITT. Gera payload copia-e-cola a partir da chave.
function norm(s, max) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 .\-']/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}
function tlv(id, val) {
  const v = String(val);
  return id + String(v.length).padStart(2, '0') + v;
}
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function buildBRCode({ key, name, city, amount, txid }) {
  if (!key) throw new Error('Chave PIX não configurada na empresa.');
  const gui = tlv('00', 'br.gov.bcb.pix') + tlv('01', String(key).trim());
  let p = tlv('00', '01') + tlv('26', gui) + tlv('52', '0000') + tlv('53', '986');
  if (amount && Number(amount) > 0) p += tlv('54', Number(amount).toFixed(2));
  p += tlv('58', 'BR') + tlv('59', norm(name, 25) || 'RECEBEDOR') + tlv('60', norm(city, 15) || 'BRASIL');
  p += tlv('62', tlv('05', norm(txid || 'ESTOQUEPRO', 25).replace(/ /g, '')));
  p += '6304';
  return p + crc16(p);
}
module.exports = { buildBRCode, norm };
