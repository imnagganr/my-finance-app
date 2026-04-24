import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { readSlip } from '../lib/slipReader'

const CATEGORIES = {
  expense: [
    { name: 'อาหาร', icon: '🍜' },
    { name: 'เดินทาง', icon: '🚗' },
    { name: 'ช้อปปิ้ง', icon: '🛍️' },
    { name: 'สุขภาพ', icon: '💊' },
    { name: 'บันเทิง', icon: '🎬' },
    { name: 'ที่พัก', icon: '🏠' },
    { name: 'สาธารณูปโภค', icon: '💡' },
    { name: 'อื่นๆ', icon: '📦' },
  ],
  income: [
    { name: 'เงินเดือน', icon: '💼' },
    { name: 'ฟรีแลนซ์', icon: '💻' },
    { name: 'ลงทุน', icon: '📈' },
    { name: 'โบนัส', icon: '🎁' },
    { name: 'อื่นๆ', icon: '💰' },
  ],
}

function findMatchingAccount(slipData, accounts) {
  if (!slipData) return { matched: null, warning: null }
  const slipAccountLast4 = (slipData.sender_account || '').replace(/\D/g, '').slice(-4)
  const slipBank = (slipData.bank_name || '').toLowerCase()
  if (!slipAccountLast4 && !slipBank) return { matched: null, warning: null }
  for (const acc of accounts) {
    const accLast4 = (acc.account_number || '').replace(/\D/g, '').slice(-4)
    const accBank = (acc.bank_name || '').toLowerCase()
    if (slipAccountLast4 && accLast4 && slipAccountLast4 === accLast4) {
      if (!slipBank || accBank.includes(slipBank) || slipBank.includes(accBank)) {
        return { matched: acc, warning: null }
      }
    }
  }
  const warningParts = []
  if (slipData.sender_name) warningParts.push(slipData.sender_name)
  if (slipData.bank_name) warningParts.push(slipData.bank_name)
  if (slipData.sender_account) warningParts.push(slipData.sender_account)
  return {
    matched: null,
    warning: warningParts.length > 0
      ? `⚠️ บัญชีในสลิป (${warningParts.join(' | ')}) ไม่ตรงกับบัญชีที่ลงไว้`
      : '⚠️ ไม่พบข้อมูลบัญชีในสลิปที่ตรงกับบัญชีที่ลงไว้'
  }
}

export default function AddTransactionModal({ session, accounts, onClose, onSuccess }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slipLoading, setSlipLoading] = useState(false)
  const [slipWarning, setSlipWarning] = useState('')

  const handleSlipUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSlipLoading(true)
    setSlipWarning('')
    const result = await readSlip(file)
    if (result) {
      if (result.amount) setAmount(result.amount.toString())
      if (result.date) setDate(result.date)
      if (result.note) setNote(result.note)
      if (result.type && CATEGORIES[result.type]) setType(result.type)
      const { matched, warning } = findMatchingAccount(result, accounts)
      if (matched) {
        setAccountId(matched.id)
        setSlipWarning(`✅ ตรงกับบัญชี: ${matched.bank_name} — ${matched.account_name}`)
      } else if (warning) {
        setSlipWarning(warning)
      }
    }
    setSlipLoading(false)
  }

  const handleSubmit = async () => {
    if (!amount || !accountId || !category) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      account_id: accountId,
      type,
      amount: parseFloat(amount),
      category_id: null,
      date,
      note: note || category,
    })
    if (error) {
      setError(error.message)
    } else {
      onSuccess()
      onClose()
    }
setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">บันทึกรายการ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button onClick={() => { setType('expense'); setCategory('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'}`}>
              รายจ่าย
            </button>
            <button onClick={() => { setType('income'); setCategory('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${type === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-500'}`}>
              รายรับ
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📎 อัพโหลดสลิป (QR + AI อ่านอัตโนมัติ)</label>
            <label className={`w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-blue-400 transition ${slipLoading ? 'opacity-50' : ''}`}>
              <input type="file" accept="image/*" className="hidden" onChange={handleSlipUpload} disabled={slipLoading} />
              {slipLoading ? (
                <span className="text-sm text-blue-500">📷 กำลังอ่านสลิป...</span>
              ) : (
                <span className="text-sm text-gray-500">แตะเพื่ออัพโหลดรูปสลิป</span>
              )}
            </label>
            {slipWarning && (
              <p className={`text-sm mt-2 px-3 py-2 rounded-lg ${slipWarning.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {slipWarning}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน <span className="text-red-500">*</span></label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บัญชี <span className="text-red-500">*</span></label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              {accounts.filter(a => a.account_type !== 'credit_card').length > 0 && (
                <optgroup label="🏦 บัญชีธนาคาร">
                  {accounts.filter(a => a.account_type !== 'credit_card').map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.bank_name} — {acc.account_name}</option>
                  ))}
                </optgroup>
              )}
              {accounts.filter(a => a.account_type === 'credit_card').length > 0 && (
                <optgroup label="💳 บัตรเครดิต">
                  {accounts.filter(a => a.account_type === 'credit_card').map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.bank_name} — {acc.account_name}{acc.account_number ? ` •••• ${acc.account_number}` : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่ <span className="text-red-500">*</span></label>
<div className="grid grid-cols-4 gap-2">
              {CATEGORIES[type].map(cat => (
                <button key={cat.name} onClick={() => setCategory(cat.name)}
                  className={`p-2 rounded-xl border-2 text-center transition ${category === cat.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="text-xs text-gray-600">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ข้าวกลางวัน, ค่าน้ำมัน"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
          </button>
        </div>
      </div>
    </div>
  )
}
