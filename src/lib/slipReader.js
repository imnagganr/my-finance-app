import jsQR from 'jsqr'

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

function parseSubTLV(data) {
  return parseEMVCo(data)
}

function extractPromptPay(merchantInfo) {
  const sub = parseSubTLV(merchantInfo)
  const mobile = sub['03'] || ''
  const nationalId = sub['02'] || ''
  let formatted = mobile
  if (mobile.startsWith('0066')) {
    formatted = '0' + mobile.substring(4)
  }
  return {
    mobile: formatted || null,
    nationalId: nationalId || null,
    promptPayId: formatted || nationalId || null
  }
}

export function parseEMVCoQR(qrString) {
  const fields = parseEMVCo(qrString)
  let isPromptPay = false
  let promptPayInfo = {}
  if (fields['30']) {
    const sub = parseSubTLV(fields['30'])
    if (sub['00'] === 'A000000677010111') {
      isPromptPay = true
      promptPayInfo = extractPromptPay(fields['30'])
    }
  }
  if (!isPromptPay && fields['29']) {
    const sub = parseSubTLV(fields['29'])
    if (sub['00'] === 'A000000677010111') {
      isPromptPay = true
      promptPayInfo = extractPromptPay(fields['29'])
    }
  }
  const amount = fields['54'] ? parseFloat(fields['54']) : null
  const country = fields['58'] || null
  const merchantName = fields['59'] || null
  const merchantCity = fields['60'] || null
  const crc = fields['63'] || null
  let reference = fields['05'] || null
  if (fields['62']) {
    const sub62 = parseSubTLV(fields['62'])
    reference = sub62['05'] || reference
  }
  return {
    isPromptPay, amount, country, merchantName,
    merchantCity, reference, crc, ...promptPayInfo
  }
}

export async function readSlipQR(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          let w = img.width
          let h = img.height
          const maxDim = 1200
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          canvas.width = w
          canvas.height = h
          ctx.drawImage(img, 0, 0, w, h)
          const imageData = ctx.getImageData(0, 0, w, h)
          let code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' })
          if (!code) {
            code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' })
          }
          if (!code) { resolve(null); return }
          const parsed = parseEMVCoQR(code.data)
          const today = new Date().toISOString().split('T')[0]
          const noteParts = []
          if (parsed.merchantName) noteParts.push(parsed.merchantName)
          if (parsed.promptPayId) noteParts.push('PromptPay: ' + parsed.promptPayId)
          if (parsed.reference) noteParts.push('Ref: ' + parsed.reference)
          resolve({
            amount: parsed.amount,
            date: today,
            note: noteParts.join(' | ') || 'QR Slip',
            type: 'expense'
          })
        } catch (err) {
          console.error('QR read error:', err)
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
