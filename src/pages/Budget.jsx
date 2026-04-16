import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { name: 'อาหาร', icon: '🍜' },
  { name: 'เดินทาง', icon: '🚗' },
  { name: 'ช้อปปิ้ง', icon: '🛍️' },
  { name: 'สุขภาพ', icon: '💊' },
  { name: 'บันเทิง', icon: '🎬' },
  { name: 'ที่พัก', icon: '🏠' },
  { name: 'สาธารณูปโภค', icon: '💡' },
  { name: 'อื่นๆ', icon: '📦' },
]

export default function Budget({ session }) {
  const [budgets, setBudgets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editBudget, setEditBudget] = useState(null)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('month', month)
      .eq('year', year)

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'expense')

    setBudgets(budgetData || [])
    setTransactions(txData || [])
    setLoading(false)
  }

  const getSpent = (categoryName) => {
    return transactions
      .filter(t => {
        const d = new Date(t.date)
        return t.note === categoryName &&
          d.getMonth() + 1 === month &&
          d.getFullYear() === year
      })
      .reduce((s, t) => s + t.amount, 0)
  }

  const handleSave = async () => {
    if (!category || !amount) return
    setSaving(true)

    if (editBudget) {
      await supabase
        .from('budgets')
        .update({ amount: parseFloat(amount) })
        .eq('id', editBudget.id)
    } else {
      await supabase.from('budgets').insert({
        user_id: session.user.id,
        category_id: null,
        amount: parseFloat(amount),
        month,
        year,
        category_name: category,
      })
    }

    setShowForm(false)
    setEditBudget(null)
    setCategory('')
    setAmount('')
    setSaving(false)
    fetchData()
  }

  const handleEdit = (budget) => {
    setEditBudget(budget)
    setCategory(budget.category_name)
    setAmount(budget.amount.toString())
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    await supabase.from('budgets').delete().eq('id', id)
    fetchData()
  }

  const formatMoney = (amount) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount)

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + getSpent(b.category_name), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">งบประมาณ</h1>
          <p className="text-sm text-gray-500">
            {now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditBudget(null); setCategory(''); setAmount('') }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-semibold px-4 py-2 rounded-xl transition"
        >
          + ตั้งงบ
        </button>
      </div>

      {/* สรุปภาพรวม */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 
                      rounded-2xl p-5 text-white mb-6 shadow-lg">
        <p className="text-blue-100 text-sm mb-1">งบรวมเดือนนี้</p>
        <p className="text-3xl font-bold">{formatMoney(totalBudget)}</p>
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-blue-100">ใช้ไปแล้ว {formatMoney(totalSpent)}</span>
            <span className="text-blue-100">
              {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
            </span>
          </div>
          <div className="bg-white/20 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                backgroundColor: totalSpent > totalBudget ? '#ef4444' : '#4ade80'
              }}
            />
          </div>
        </div>
      </div>

      {/* รายการงบ */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-2">🎯</p>
          <p className="text-gray-500 text-sm">ยังไม่มีงบประมาณ</p>
          <p className="text-gray-400 text-xs mt-1">กด "+ ตั้งงบ" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = getSpent(budget.category_name)
            const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
            const cat = CATEGORIES.find(c => c.name === budget.category_name)
            const isOver = percent > 100
            const isWarning = percent >= 80 && !isOver

            return (
              <div key={budget.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat?.icon || '📦'}</span>
                    <div>
                      <p className="font-medium text-gray-800">{budget.category_name}</p>
                      <p className="text-xs text-gray-400">
                        ใช้ {formatMoney(spent)} / {formatMoney(budget.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOver && <span className="text-xs text-red-500 font-semibold">⚠️ เกินงบ!</span>}
                    <span className={`text-sm font-bold ${
                      isOver ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-gray-600'
                    }`}>
                      {Math.round(percent)}%
                    </span>
                    <button
                      onClick={() => handleEdit(budget)}
                      className="text-gray-400 hover:text-blue-500 text-sm"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >🗑️</button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: isOver ? '#ef4444' : isWarning ? '#eab308' : '#22c55e'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal ตั้งงบ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editBudget ? 'แก้ไขงบประมาณ' : 'ตั้งงบประมาณ'}
              </h2>
              <button onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* เลือกหมวดหมู่ */}
              {!editBudget && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมวดหมู่
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => setCategory(cat.name)}
                        className={`p-2 rounded-xl border-2 text-center transition ${
                          category === cat.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{cat.icon}</div>
                        <div className="text-xs text-gray-600">{cat.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* จำนวนเงิน */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  งบประมาณ (บาท)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                             focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white
                           font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : editBudget ? 'บันทึกการแก้ไข' : 'ตั้งงบประมาณ'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}