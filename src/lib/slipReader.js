import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';

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

function extractPromptPay(qrData) {
  // Tag 29 or 30 = merchant account info (PromptPay)
  const tag29 = qrData['29'] || qrData['30'];
  if (!tag29) return null;

  const sub = parseSubTLV(tag29);
  // AID 00 = PromptPay proxy type
  const aid = sub['00'] || '';
  // Tag 01 = proxy value (phone or national ID)
  const proxyValue = sub['01'] || '';

  return { aid, proxyValue };
}

function parseEMVCoQR(qrText) {
  const data = {};
  let pos = 0;
  while (pos + 4 <= qrText.length) {
    const tag = qrText.substring(pos, pos + 2);
    const len = parseInt(qrText.substring(pos + 2, pos + 4), 10);
    if (isNaN(len) || pos + 4 + len > qrText.length) break;
    const value = qrText.substring(pos + 4, pos + 4 + len);
    data[tag] = value;
    pos += 4 + len;
  }

  // Tag 00 = payload format indicator
  if (data['00'] !== '01') return null;

  // Tag 01 = point of initiation (11=static, 12=dynamic)
  const isDynamic = data['01'] === '12';

  // Tag 54 = transaction amount
  const amount = data['54'] || null;

  // Tag 53 = currency (764 = THB)
  const currency = data['53'] || null;

  // Tag 58 = country code
  const country = data['58'] || null;

  // Tag 62 = additional data (bill payment ref, etc.)
  const additionalData = data['62'] ? parseSubTLV(data['62']) : {};

  const promptPay = extractPromptPay(data);

  const pp = promptPay;
  return {
    type: 'expense',
    amount: amount ? parseFloat(amount) : null,
    date: new Date().toISOString().split('T')[0],
    note: pp.promptPayId ? 'PromptPay: ' + pp.promptPayId : 'QR Slip',
    sender_account: pp.promptPayId || null,
    bank_name: null,
    reference: additionalData['05'] || additionalData['01'] || null,
    source: 'qr',
    _raw: { isDynamic, currency, country, promptPay: pp, data },
  };
}

// ─── Layer 1: QR Code Reading ────────────────────────────────────────

async function tryQRRead(imageSource) {
  try {
    let imageData;
    let width;
    let height;

    if (imageSource instanceof HTMLCanvasElement) {
      const ctx = imageSource.getContext('2d');
      width = imageSource.width;
      height = imageSource.height;
      imageData = ctx.getImageData(0, 0, width, height);
    } else if (imageSource instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = imageSource.videoWidth;
      canvas.height = imageSource.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageSource, 0, 0);
      width = canvas.width;
      height = canvas.height;
      imageData = ctx.getImageData(0, 0, width, height);
    } else {
      // Assume it's a File/Blob → load into Image
      const img = await loadImageFromBlob(imageSource);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      width = canvas.width;
      height = canvas.height;
      imageData = ctx.getImageData(0, 0, width, height);
    }

    const code = jsQR(imageData.data, width, height);
    if (code && code.data) {
      const parsed = parseEMVCoQR(code.data);
      if (parsed) {
        return { ...parsed, rawQR: code.data };
      }
      // QR found but not EMVCo format — return raw text
      return { type: 'qr_raw', text: code.data };
    }
  } catch (err) {
    console.warn('[slipReader] QR read failed:', err.message);
  }
  return null;
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ─── Layer 2: Tesseract.js OCR Fallback ──────────────────────────────

const BANK_PATTERNS = {
  'ttb': ['ttb', 'ทีทีบี', 'TTB'],
  'scb': ['SCB', 'ไทยพาณิชย์', 'SCB ไทยพาณิชย์'],
  'ktb': ['KTB', 'กรุงไทย'],
  'bbl': ['กรุงเทพ', 'BBL', 'Bangkok Bank'],
  'kbank': ['กสิกร', 'KBANK', 'KBank'],
  'bay': ['กรุงศรี', 'BAY', 'Krungsri'],
  'gsb': ['ออมสิน', 'GSB'],
  'BAAC': ['BAAC', 'ธ.ก.ส.', 'ธกส'],
};

function parseThaiSlipText(text) {
  if (!text) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text;

  // ── Amount ──
  let amount = null;
  // Match "60.00", "1,250.50", amounts with THB prefix
  const amountPatterns = [
    /(?:จำนวน|Amount|ยอด|จ่าย|โอน)[^\d]*([\d,]+\.\d{2})/i,
    /(?:THB|฿)\s*([\d,]+\.\d{2})/i,
    /(?:฿)\s*([\d,]+(?:\.\d{2})?)/,
    /([\d,]+\.\d{2})\s*(?:บาท|THB|฿)/i,
    // Standalone decimal near common keywords
    /(?:โอน|ส่ง|จ่าย)\s+(?:สำเร็จ|แล้ว)?\s*([\d,]+\.\d{2})/i,
  ];
  for (const pat of amountPatterns) {
    const m = fullText.match(pat);
    if (m) {
      amount = parseFloat(m[1].replace(/,/g, ''));
      break;
    }
  }
  // Fallback: last standalone decimal number in the text
  if (amount === null) {
    const allAmounts = [...fullText.matchAll(/(?:^|\s)([\d,]+\.\d{2})(?:\s|$)/g)];
    if (allAmounts.length > 0) {
      amount = parseFloat(allAmounts[allAmounts.length - 1][1].replace(/,/g, ''));
    }
  }

  // ── Date ──
  let date = null;
  // Thai month abbreviations
  const thaiMonths = {
    'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
    'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
    'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03',
    'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
    'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09',
    'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
  };

  // "21 เม.ย. 69" or "21 เมษายน 2569"
  const thaiDatePattern = /(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{2,4})/;
  const thaiMatch = fullText.match(thaiDatePattern);
  if (thaiMatch) {
    const day = thaiMatch[1].padStart(2, '0');
    const month = thaiMonths[thaiMatch[2]] || '01';
    let year = thaiMatch[3];
    // Convert Thai Buddhist year to CE
    if (year.length === 2) year = (parseInt(year) + 2500).toString();
    if (parseInt(year) > 2400) year = (parseInt(year) - 543).toString();
    date = `${year}-${month}-${day}`;
  }

  // "21/04/2569" or "21-04-2026"
  if (!date) {
    const dmyPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const dmyMatch = fullText.match(dmyPattern);
    if (dmyMatch) {
      let day = dmyMatch[1].padStart(2, '0');
      let month = dmyMatch[2].padStart(2, '0');
      let year = parseInt(dmyMatch[3]);
      if (year > 2400) year -= 543; // Thai year
      date = `${year}-${month}-${day}`;
    }
  }

  // ── Time ──
  let time = null;
  const timeMatch = fullText.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (timeMatch) time = timeMatch[1];

  // ── Account numbers ──
  let senderAccount = null;
  let receiverAccount = null;

  // "XXX-X-XX851-1" or "123-4-56789-0" patterns
  const dashAccountPattern = /(\d{3}-\d-\d{2}\d+-\d)/g;
  const dashAccounts = [...fullText.matchAll(dashAccountPattern)].map(m => m[1]);

  // Generic account: 10-12 digit numbers that look like accounts
  const digitAccountPattern = /(\d{10,12})/g;
  const digitAccounts = [...fullText.matchAll(digitAccountPattern)].map(m => m[1]);

  // Context-based assignment
  const fromIdx = fullText.search(/(?:จาก|From|ต้นทาง|บัญชีต้นทาง)/i);
  const toIdx = fullText.search(/(?:ถึง|To|ปลายทาง|บัญชีปลายทาง|ผู้รับ)/i);

  if (dashAccounts.length >= 2) {
    if (fromIdx > -1 && toIdx > -1) {
      // Find which account is closer to "from" vs "to"
      const fromAccount = dashAccounts.find(a => fullText.indexOf(a) > fromIdx && fullText.indexOf(a) < (toIdx > fromIdx ? toIdx : fromIdx + 50));
      const toAccount = dashAccounts.find(a => fullText.indexOf(a) > toIdx);
      senderAccount = fromAccount || dashAccounts[0];
      receiverAccount = toAccount || dashAccounts[1];
    } else {
      senderAccount = dashAccounts[0];
      receiverAccount = dashAccounts[1];
    }
  } else if (dashAccounts.length === 1) {
    receiverAccount = dashAccounts[0];
  }

  // ── Bank name ──
  let bank = null;
  for (const [bankKey, patterns] of Object.entries(BANK_PATTERNS)) {
    for (const p of patterns) {
      if (fullText.toLowerCase().includes(p.toLowerCase())) {
        bank = bankKey;
        break;
      }
    }
    if (bank) break;
  }

  // ── Receiver name ──
  let receiverName = null;
  const receiverPatterns = [
    /(?:ถึง|To|ผู้รับ|ชื่อบัญชี|Account Name)\s*[:\s]*([^\n]+)/i,
    /(?:นาย|นาง|นางสาว|Mr\.|Mrs\.|Ms\.)\s*([^\n]{2,50})/i,
  ];
  for (const pat of receiverPatterns) {
    const m = fullText.match(pat);
    if (m) {
      receiverName = m[1].trim();
      break;
    }
  }

  // ── Reference number ──
  let reference = null;
  const refPatterns = [
    /(?:หมายเลขอ้างอิง|Reference|Ref\.?|เลขที่อ้างอิง|Transaction ID|TXN)\s*[:\s]*(\d{6,})/i,
    /(?:รหัสอ้างอิง)\s*[:\s]*([A-Za-z0-9]{6,})/i,
  ];
  for (const pat of refPatterns) {
    const m = fullText.match(pat);
    if (m) {
      reference = m[1];
      break;
    }
  }

  // ── Transaction type ──
  let txType = null;
  if (/โอนเงิน/i.test(fullText)) txType = 'transfer';
  else if (/ชำระเงิน|จ่ายเงิน|Pay/i.test(fullText)) txType = 'payment';
  else if (/รับเงิน|Receive/i.test(fullText)) txType = 'receive';

  return {
    type: 'expense',
    amount,
    date,
    note: receiverName || bank || 'OCR Slip',
    sender_account: senderAccount,
    bank_name: bank,
    receiver_name: receiverName,
    receiver_account: receiverAccount,
    reference,
    txType,
    rawText: fullText,
    source: 'ocr',
  };
}

async function tryOCRRead(imageSource) {
  try {
    // Convert imageSource to something Tesseract can process
    let image;
    if (imageSource instanceof HTMLCanvasElement) {
      image = imageSource.toDataURL('image/png');
    } else if (imageSource instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = imageSource.videoWidth;
      canvas.height = imageSource.videoHeight;
      canvas.getContext('2d').drawImage(imageSource, 0, 0);
      image = canvas.toDataURL('image/png');
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      image = imageSource;
    } else if (typeof imageSource === 'string') {
      image = imageSource; // URL or data URI
    } else {
      image = imageSource;
    }

    const result = await Tesseract.recognize(image, 'tha+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[slipReader] OCR progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const { data } = result;
    if (!data || !data.text || data.text.trim().length < 5) {
      console.warn('[slipReader] OCR returned too little text');
      return null;
    }

    const parsed = parseThaiSlipText(data.text);
    return parsed;
  } catch (err) {
    console.error('[slipReader] OCR failed:', err.message);
    return null;
  }
}

// ─── Main Entry Point: 2-Layer Slip Reader ───────────────────────────

/**
 * Read a Thai bank slip image.
 * Layer 1: QR code scan (jsQR + EMVCo parsing)
 * Layer 2: OCR text extraction (Tesseract.js) — fallback
 *
 * @param {HTMLCanvasElement|HTMLVideoElement|File|Blob|string} imageSource
 * @returns {Promise<object | null>}
 */
export async function readSlip(imageSource) {
  // Layer 1: Try QR code
  console.log('[slipReader] Layer 1: Attempting QR read...');
  const qrResult = await tryQRRead(imageSource);
  if (qrResult) {
    console.log('[slipReader] QR read succeeded');
    return { ...qrResult, _layer: 'qr' };
  }
  console.log('[slipReader] QR read failed or no EMVCo QR found');

  // Layer 2: OCR fallback
  console.log('[slipReader] Layer 2: Attempting OCR read...');
  const ocrResult = await tryOCRRead(imageSource);
  if (ocrResult) {
    console.log('[slipReader] OCR read succeeded');
    return { ...ocrResult, _layer: 'ocr' };
  }

  console.warn('[slipReader] Both QR and OCR failed');
  return null;
}

// ─── Exports ─────────────────────────────────────────────────────────

export { parseEMVCoQR, parseThaiSlipText, tryQRRead, tryOCRRead };
