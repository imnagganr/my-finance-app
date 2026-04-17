import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

export async function readSlip(imageBase64, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64
        }
      },
      `วิเคราะห์สลิปโอนเงินนี้แล้วตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น:
{
  "amount": <จำนวนเงินเป็นตัวเลขอย่างเดียว>,
  "date": "<วันที่ในรูปแบบ YYYY-MM-DD>",
  "note": "<รายละเอียดการโอน เช่น ชื่อผู้รับหรือผู้โอน>",
  "type": "expense"
}`
    ])

    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    console.error('Gemini error:', e)
    return null
  }
}