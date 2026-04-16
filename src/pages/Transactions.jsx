import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Papa from 'papaparse'

export default function Transactions({ session }) {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: txData } = await supabase
      .from('transactions').select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })

    const { data: accData } = await supabase
      .from('bank_accounts').select('*')
      .eq('user_id', session.user.id)

    setTransactions(txData || [])
    setAccounts(accData || [])
    setLoading(false)
  }

  const getAccountName = (accountId) => {
    const acc = accounts.find(a => a.id === accountId)
    return acc ? `${acc.bank_name} - ${acc.account_name}` : 'ไม่ระบุ'
  }

  const filtered = transactions.filter(t => {
    const matchType = filterType === 'all' || t.type === filterType
    const matchMonth = !filterMonth || t.date.startsWith(filterMonth)
    return matchType && matchMonth
  })

  const totalIncome = filtered
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

  const totalExpense = filtered
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const formatMoney = (amount) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount)

  const handleExportCSV = () => {
    const csvData = filtered.map(t => ({
      วันที่: t.date,
      ประเภท: t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      จำนวนเงิน: t.amount,
      บัญชี: getAccountName(t.account_id),
      หมายเหตุ: t.note || '',
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `รายการ_${filterMonth || 'ทั้งหมด'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">รายการทั้งหมด</h1>
        <button
          onClick={handleExportCSV}
          className="bg-green-600 hover:bg-green-700 text-white text-sm
                     font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">ทุกประเภท</option>
          <option value="income">รายรับ</option>
          <option value="expense">รายจ่าย</option>
        </select>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* สรุป */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-xs text-green-600 mb-1">รายรับรวม</p>
          <p className="text-lg font-bold text-green-700">{formatMoney(totalIncome)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <p className="text-xs text-red-600 mb-1">รายจ่ายรวม</p>
          <p className="text-lg font-bold text-red-700">{formatMoney(totalExpense)}</p>
        </div>
      </div>

      {/* รายการ */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-2">📝</p>
          <p className="text-gray-500 text-sm">ไม่มีรายการ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => (
            <div key={tx.id}
              className="bg-white rounded-xl p-4 flex justify-between
                         items-center shadow-sm border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {tx.note || 'ไม่มีหมายเหตุ'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {tx.date} · {getAccountName(tx.account_id)}
                </p>
              </div>
              <p className={`font-semibold ${
                tx.type === 'income' ? 'text-green-600' : 'text-red-500'
              }`}>
                {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}