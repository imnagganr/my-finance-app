import jsQR from 'jsqr';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─── EMVCo QR Parsing (Layer 1) ─────────────────────────────────────

function parseSubTLV(data) {
  const result = {};
  let pos = 0;
  while (pos + 4 <= data.length) {
    const tag = data.substring(pos, pos + 2);
    const len = parseInt(data.substring(pos + 2, pos + 4), 10);
    if (isNaN(len) || pos + 4 + len > data.length) break;
    const value = data.substring(pos + 4, pos + 4 + len);
    result[tag] = value;
    pos += 4 + len;
  }
  return result;
}

function extractPromptPay(merchantInfo) {
  const sub = parseSubTLV(merchantInfo);
  const mobile = sub['03'] || '';
  const nationalId = sub['02'] || '';
  let formatted = mobile;
  if (mobile.startsWith('0066')) formatted = '0' + mobile.substring(4);
  return { mobile: formatted || null, nationalId: nationalId || null, promptPayId: formatted || nationalId || null };
}

export function parseEMVCoQR(qrString) {
  const fields = parseSubTLV(qrString);
  if (fields['00'] !== '01') return null;

  let isPromptPay = false;
  let promptPayInfo = {};
  if (fields['30']) {
    const sub = parseSubTLV(fields['30']);
    if (sub['00'] === 'A000000677010111') { isPromptPay = true; promptPayInfo = extractPromptPay(fields['30']); }
  }
  if (!isPromptPay && fields['29']) {
    const sub = parseSubTLV(fields['29']);
    if (sub['00'] === 'A000000677010111') { isPromptPay = true; promptPayInfo = extractPromptPay(fields['29']); }
  }

  const amount = fields['54'] ? parseFloat(fields['54']) : null;
  let reference = null;
  if (fields['62']) { const sub62 = parseSubTLV(fields['62']); reference = sub62['05'] || sub62['01'] || null; }

  return {
    isPromptPay, amount,
    country: fields['58'] || null,
    merchantName: fields['59'] || null,
    reference,
    ...promptPayInfo,
  };
}

// ─── Layer 1: QR Code Reading ────────────────────────────────────────

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function tryQRRead(imageSource) {
  try {
    const img = await loadImageFromBlob(imageSource);
    const canvas = document.createElement('canvas');
    const maxDim = 1200;
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale); h = Math.round(h * scale);
    }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    let code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (!code) code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
    if (!code) return null;

    const parsed = parseEMVCoQR(code.data);
    if (!parsed) return { type: 'qr_raw', text: code.data };

    const today = new Date().toISOString().split('T')[0];
    const noteParts = [];
    if (parsed.merchantName) noteParts.push(parsed.merchantName);
    if (parsed.promptPayId) noteParts.push('PromptPay: ' + parsed.promptPayId);
    if (parsed.reference) noteParts.push('Ref: ' + parsed.reference);

    return {
      type: 'expense',
      amount: parsed.amount,
      date: today,
      note: noteParts.join(' | ') || 'QR Slip',
      source: 'qr',
    };
  } catch (err) {
    console.warn('[slipReader] QR read failed:', err.message);
    return null;
  }
}

// ─── Layer 2: Gemini Vision ───────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function tryGeminiRead(file) {
  if (!GEMINI_API_KEY) {
    console.warn('[slipReader] No Gemini API key');
    return null;
  }
  try {
    const base64 = await fileToBase64(file);
    const prompt = `วิเคราะห์รูปสลิปธนาคารไทยนี้ แล้วตอบเป็น JSON เท่านั้น ห้ามมี markdown หรือ code block:
{"amount": <จำนวนเงินเป็นตัวเลข ไม่ใส่ comma>, "date": "<YYYY-MM-DD ถ้าเป็นปีพ.ศ.ให้ลบ 543>", "note": "<บันทึกช่วยจำจากสลิป หรือชื่อร้าน/ผู้รับ>", "bank_name": "<ชื่อธนาคาร>", "type": "expense"}
ถ้าไม่พบข้อมูลใส่ null`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } },
          ]}],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[slipReader] Gemini HTTP error:', res.status, err);
      return null;
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json|```/g, '').trim();
    console.log('[slipReader] Gemini raw:', text);
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      type: parsed.type || 'expense',
      amount: parsed.amount ? parseFloat(parsed.amount) : null,
      date: parsed.date || null,
      note: parsed.note || parsed.bank_name || 'Gemini Slip',
      bank_name: parsed.bank_name || null,
      source: 'gemini',
    };
  } catch (err) {
    console.error('[slipReader] Gemini read error:', err.message);
    return null;
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────

export async function readSlip(imageSource) {
  console.log('[slipReader] Layer 1: Attempting QR read...');
  const qrResult = await tryQRRead(imageSource);
  if (qrResult && qrResult.type !== 'qr_raw' && qrResult.amount) {
    console.log('[slipReader] QR read succeeded (EMVCo with amount)');
    return { ...qrResult, _layer: 'qr' };
  }
  if (qrResult) console.log('[slipReader] QR found but no amount — falling through to Gemini');
  else console.log('[slipReader] No QR found — trying Gemini');

  console.log('[slipReader] Layer 2: Attempting Gemini read...');
  const geminiResult = await tryGeminiRead(imageSource);
  if (geminiResult) {
    console.log('[slipReader] Gemini read succeeded');
    return { ...geminiResult, _layer: 'gemini' };
  }

  console.warn('[slipReader] Both layers failed');
  return null;
}

export { parseEMVCoQR as default };
