import jsQR from 'jsqr'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

function parseEMVCo(data) {
  const result = {}
  let i = 0
  while (i + 4 <= data.length) {
    const tag = data.substring(i, i + 2)
    const len = parseInt(data.substring(i + 2, i + 4), 10)
    if (isNaN(len) || i + 4 + len > data.length) break
    const value = data.substring(i + 4, i + 4 + len)
    result[tag] = value
    i += 4 + len
  }
  return result
}
function parseSubTLV(data) { return parseEMVCo(data) }

function extractPromptPay(merchantInfo) {
  const sub = parseSubTLV(merchantInfo)
  const mobile = sub['03'] || ''
  const nationalId = sub['02'] || ''
  let formatted = mobile
  if (mobile.startsWith('0066')) formatted = '0' + mobile.substring(4)
  return { mobile: formatted || null, nationalId: nationalId || null, promptPayId: formatted || nationalId || null }
}

export function parseEMVCoQR(qrString) {
  const fields = parseEMVCo(qrString)
  let isPromptPay = false, promptPayInfo = {}
  if (fields['30']) { const sub = parseSubTLV(fields['30']); if (sub['00'] === 'A000000677010111') { isPromptPay = true; promptPayInfo = extractPromptPay(fields['30']) } }
  if (!isPromptPay && fields['29']) { const sub = parseSubTLV(fields['29']); if (sub['00'] === 'A000000677010111') { isPromptPay = true; promptPayInfo = extractPromptPay(fields['29']) } }
  const amount = fields['54'] ? parseFloat(fields['54']) : null
  let reference = fields['05'] || null
  if (fields['62']) { const sub62 = parseSubTLV(fields['62']); reference = sub62['05'] || reference }
  return { isPromptPay, amount, country: fields['58'] || null, merchantName: fields['59'] || null, merchantCity: fields['60'] || null, reference, crc: fields['63'] || null, ...promptPayInfo }
}

function tryQRRead(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          let w = img.width, h = img.height
          const maxDim = 1200
          if (w > maxDim || h > maxDim) { const scale = maxDim / Math.max(w, h); w = Math.round(w * scale); h = Math.round(h * scale) }
          canvas.width = w; canvas.height = h
          ctx.drawImage(img, 0, 0, w, h)
          const imageData = ctx.getImageData(0, 0, w, h)
          let code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' })
          if (!code) code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' })
          if (!code) { resolve(null); return }
          const parsed = parseEMVCoQR(code.data)
          const today = new Date().toISOString().split('T')[0]
          const noteParts = []
          if (parsed.merchantName) noteParts.push(parsed.merchantName)
          if (parsed.promptPayId) noteParts.push('PromptPay: ' + parsed.promptPayId)
          if (parsed.reference) noteParts.push('Ref: ' + parsed.reference)
          resolve({ amount: parsed.amount, date: today, note: noteParts.join(' | ') || 'QR Slip', type: 'expense', source: 'qr', sender_account: parsed.promptPayId || null, bank_name: null, sender_name: null, receiver_name: parsed.merchantName || null, reference: parsed.reference || null })
        } catch (err) { console.error('QR read error:', err); resolve(null) }
      }
      img.onerror = () => resolve(null)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function tryGeminiRead(file) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const base64 = await fileToBase64(file)
    const prompt = 'วิเคราะห์รูปสลิป/ใบเสร็จทางการเงินนี้ แล้วตอบเป็น JSON เท่านั้น (ไม่ต้องมี markdown ครอบ):\n{"amount": <จำนวนเงินเป็นตัวเลข>, "date": "<YYYY-MM-DD แปลงจากพ.ศ.ถ้าจำเป็น>", "sender_name": "<ชื่อผู้ส่ง>", "sender_account": "<เลขบัญชี>", "receiver_name": "<ชื่อผู้รับ>", "receiver_account": "<เลขบัญชีผู้รับ>", "bank_name": "<ธนาคาร>", "reference": "<รหัสอ้างอิง>", "type": "<expense หรือ income>", "note": "<สรุปสั้นๆ>"}\nถ้าไม่พบข้อมูลบาง field ให้ใส่ null ห้ามเดา ถ้าเป็นพ.ศ.ให้ลบ 543'
    const result = await model.generateContent([prompt, { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } }])
    const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(text)
    return {
      amount: parsed.amount ? parseFloat(parsed.amount) : null,
      date: parsed.date || new Date().toISOString().split('T')[0],
      note: parsed.note || [parsed.sender_name && 'จาก ' + parsed.sender_name, parsed.receiver_name && 'ไป ' + parsed.receiver_name].filter(Boolean).join(' | ') || 'Gemini Slip',
      type: parsed.type || 'expense', source: 'gemini',
      sender_name: parsed.sender_name, sender_account: parsed.sender_account, bank_name: parsed.bank_name, receiver_name: parsed.receiver_name, reference: parsed.reference
    }
  } catch (err) { console.error('Gemini read error:', err); return null }
}

export async function readSlip(file) {
  console.log('[SlipReader] Trying QR...')
  const qrResult = await tryQRRead(file)
  if (qrResult && qrResult.amount) { console.log('[SlipReader] QR success'); return qrResult }
  console.log('[SlipReader] Trying Gemini...')
  const geminiResult = await tryGeminiRead(file)
  if (geminiResult) { console.log('[SlipReader] Gemini success'); return geminiResult }
  console.log('[SlipReader] Both failed')
  return qrResult || null
}

export async function readSlipQR(file) { return readSlip(file) }
