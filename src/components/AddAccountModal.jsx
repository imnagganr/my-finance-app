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

const CARD_NETWORKS = [
  { name: 'Visa', color: '#1a1f71' },
  { name: 'Mastercard', color: '#eb001b' },
  { name: 'JCB', color: '#003087' },
  { name: 'UnionPay', color: '#c0392b' },
  { name: 'Amex', color: '#007bc1' },
]

export default function AddAccountModal({ session, onClose, onSuccess }) {
  const [accountType, setAccountType] = useState('bank')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [cardNetwork, setCardNetwork] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelectBank = (bank) => {
    setBankName(bank.name)
    setColor(bank.color)
  }

  const handleSelectNetwork = (net) => {
    setCardNetwork(net.name)
    setColor(net.color)
  }

  const handleSubmit = async () => {
    if (accountType === 'bank' && (!bankName || !accountName)) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    if (accountType === 'credit_card' && (!bankName || !cardNetwork)) {
      setError('กรุณาเลือกธนาคารและประเภทบัตร')
      return
    }
    if (accountType === 'credit_card' && accountNumber && accountNumber.length !== 4) {
      setError('เลขท้ายบัตรต้องมี 4 หลัก')
      return
    }

    const insertData = {
      user_id: session.user.id,
      bank_name: bankName,
      account_name: accountType === 'credit_card' ? cardNetwork : accountName,
      account_number: accountNumber,
      initial_balance: accountType === 'credit_card' ? 0 : (parseFloat(initialBalance) || 0),
      color,
      account_type: accountType,
    }

    setLoading(true)
    const { error } = await supabase.from('bank_accounts').insert(insertData)
    if (error) {
      setError(error.message)
    } else {
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  const previewLabel = accountType === 'credit_card'
    ? `${cardNetwork} •••• ${accountNumber || '0000'}`
    : (accountName || 'ชื่อบัญชี')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">เพิ่มบัญชี</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* ประเภทบัญชี */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button
              onClick={() => { setAccountType('bank'); setCardNetwork('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${
                accountType === 'bank' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'
              }`}
            >
              🏦 บัญชีธนาคาร
            </button>
            <button
              onClick={() => { setAccountType('credit_card'); setInitialBalance('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${
                accountType === 'credit_card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'
              }`}
            >
              💳 บัตรเครดิต
            </button>
          </div>

          {/* เลือกธนาคาร */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกธนาคาร</label>
            <div className="grid grid-cols-3 gap-2">
              {BANKS.map(bank => (
                <button
                  key={bank.name}
                  onClick={() => handleSelectBank(bank)}
                  className={`text-xs p-2 rounded-lg border-2 transition ${
                    bankName === bank.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: bank.color }} />
                  {bank.name}
                </button>
              ))}
            </div>
          </div>

          {/* บัตรเครดิต: เลือก network */}
          {accountType === 'credit_card' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ประเภทบัตร <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {CARD_NETWORKS.map(net => (
                  <button
                    key={net.name}
                    onClick={() => handleSelectNetwork(net)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                      cardNetwork === net.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {net.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* บัญชีธนาคาร: ชื่อบัญชี */}
          {accountType === 'bank' && (
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
          )}

          {/* เลขบัญชี / เลขท้ายบัตร */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {accountType === 'credit_card' ? 'เลข 4 หลักท้ายบัตร (ไม่บังคับ)' : 'เลขบัญชี (ไม่บังคับ)'}
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setAccountNumber(accountType === 'credit_card' ? val.slice(0, 4) : val)
              }}
              placeholder={accountType === 'credit_card' ? '0000' : 'xxx-x-xxxxx-x'}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* ยอดเงินเริ่มต้น (เฉพาะบัญชีธนาคาร) */}
          {accountType === 'bank' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินเริ่มต้น</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {/* Preview */}
          {bankName && (
            accountType === 'credit_card' ? (
              <div className="rounded-xl p-4 text-white relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${color}, #000)` }}>
                <p className="text-xs opacity-70 mb-3">{bankName}</p>
                <p className="text-lg font-mono tracking-widest mb-2">
                  •••• •••• •••• {accountNumber || '????'}
                </p>
                <p className="font-semibold text-sm">{cardNetwork || 'ประเภทบัตร'}</p>
                <p className="absolute top-4 right-4 text-2xl opacity-30">💳</p>
              </div>
            ) : (
              <div className="rounded-xl p-4 text-white" style={{ backgroundColor: color }}>
                <p className="text-xs opacity-80">{bankName}</p>
                <p className="font-semibold">{previewLabel}</p>
                <p className="text-xl font-bold mt-1">
                  ฿{parseFloat(initialBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : `เพิ่ม${accountType === 'credit_card' ? 'บัตรเครดิต' : 'บัญชี'}`}
          </button>

        </div>
      </div>
    </div>
  )
}
