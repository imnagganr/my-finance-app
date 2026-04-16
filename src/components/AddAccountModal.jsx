import { useState } from 'react'
import { supabase } from '../lib/supabase'

const BANKS = [
  { name: 'กสิกรไทย', color: '#138f2d' },
  { name: 'ไทยพาณิชย์ (SCB)', color: '#4e2d8c' },
  { name: 'กรุงเทพ (BBL)', color: '#1e4598' },
  { name: 'กรุงไทย', color: '#00a0e9' },
  { name: 'กรุงศรี', color: '#fec43b' },
  { name: 'ทหารไทยธนชาต (TTB)', color: '#00a8a8' },
  { name: 'ออมสิน', color: '#eb198d' },
  { name: 'PromptPay', color: '#6366f1' },
  { name: 'เงินสด', color: '#16a34a' },
  { name: 'อื่นๆ', color: '#6b7280' },
]

export default function AddAccountModal({ session, onClose, onSuccess }) {
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelectBank = (bank) => {
    setBankName(bank.name)
    setColor(bank.color)
  }

  const handleSubmit = async () => {
    if (!bankName || !accountName) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('bank_accounts').insert({
      user_id: session.user.id,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      initial_balance: parseFloat(initialBalance) || 0,
      color,
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
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">เพิ่มบัญชีธนาคาร</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* เลือกธนาคาร */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              เลือกธนาคาร
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BANKS.map(bank => (
                <button
                  key={bank.name}
                  onClick={() => handleSelectBank(bank)}
                  className={`text-xs p-2 rounded-lg border-2 transition ${
                    bankName === bank.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: bank.color }}
                  />
                  {bank.name}
                </button>
              ))}
            </div>
          </div>

          {/* ชื่อบัญชี */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อบัญชี <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="เช่น บัญชีเงินเดือน, บัญชีออมทรัพย์"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* เลขบัญชี */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เลขบัญชี (ไม่บังคับ)
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="xxx-x-xxxxx-x"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* ยอดเงินเริ่มต้น */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ยอดเงินเริ่มต้น
            </label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Preview */}
          {bankName && (
            <div
              className="rounded-xl p-4 text-white"
              style={{ backgroundColor: color }}
            >
              <p className="text-xs opacity-80">{bankName}</p>
              <p className="font-semibold">{accountName || 'ชื่อบัญชี'}</p>
              <p className="text-xl font-bold mt-1">
                ฿{parseFloat(initialBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          {/* ปุ่ม */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white 
                       font-semibold py-3 rounded-xl transition
                       disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'เพิ่มบัญชี'}
          </button>

        </div>
      </div>
    </div>
  )
}