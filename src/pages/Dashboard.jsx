import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AddAccountModal from '../components/AddAccountModal'
import AddTransactionModal from '../components/AddTransactionModal'
import MonthlyChart from '../components/MonthlyChart'

export default function Dashboard({ session }) {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: accountData } = await supabase
      .from('bank_accounts').select('*').eq('user_id', session.user.id)
    const { data: txData } = await supabase
      .from('transactions').select('*').eq('user_id', session.user.id)
    setAccounts(accountData || [])
    setTransactions(txData || [])
    setLoading(false)
  }

  const getAccBalance = (acc) => {
    const income = transactions.filter(t => t.account_id === acc.id && t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = transactions.filter(t => t.account_id === acc.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return acc.initial_balance + income - expense
  }

  const bankAccounts = accounts.filter(a => a.account_type !== 'credit_card')
  const creditCards = accounts.filter(a => a.account_type === 'credit_card')

  const totalBalance = bankAccounts.reduce((sum, acc) => sum + getAccBalance(acc), 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const formatMoney = (amount) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* ยอดรวม */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <p className="text-blue-100 text-sm mb-1">ยอดเงินรวมทุกบัญชี</p>
        <p className="text-4xl font-bold mb-4">{formatMoney(totalBalance)}</p>
        <div className="flex gap-6">
          <div>
            <p className="text-blue-100 text-xs">รายรับรวม</p>
            <p className="text-green-300 font-semibold">+{formatMoney(totalIncome)}</p>
          </div>
          <div>
            <p className="text-blue-100 text-xs">รายจ่ายรวม</p>
            <p className="text-red-300 font-semibold">-{formatMoney(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* ปุ่มบันทึกรายการ */}
      <button
        onClick={() => setShowAddTransaction(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl mb-6 transition"
      >
        + บันทึกรายการ
      </button>

      {/* บัญชีธนาคาร */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">🏦 บัญชีธนาคาร</h2>
          <button onClick={() => setShowAddAccount(true)} className="text-sm text-blue-600 hover:underline">
            + เพิ่มบัญชี
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-2">🏦</p>
            <p className="text-gray-500 text-sm">ยังไม่มีบัญชี</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {bankAccounts.map(acc => (
              <div key={acc.id} className="rounded-2xl p-4 text-white shadow-sm"
                style={{ backgroundColor: acc.color || '#3B82F6' }}>
                <p className="text-xs opacity-80 mb-1">{acc.bank_name}</p>
                <p className="font-semibold text-sm mb-2">{acc.account_name}</p>
                <p className="text-xl font-bold">{formatMoney(getAccBalance(acc))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* บัตรเครดิต */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">💳 บัตรเครดิต</h2>

        {creditCards.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
            <p className="text-3xl mb-2">💳</p>
            <p className="text-gray-500 text-sm">ยังไม่มีบัตรเครดิต</p>
            <button onClick={() => setShowAddAccount(true)}
              className="mt-2 text-sm text-blue-600 hover:underline">
              + เพิ่มบัตรเครดิต
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {creditCards.map(acc => {
              const spent = transactions
                .filter(t => t.account_id === acc.id && t.type === 'expense')
                .reduce((s, t) => s + t.amount, 0)
              return (
                <div key={acc.id} className="rounded-2xl p-4 text-white shadow-sm relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${acc.color || '#1a1f71'}, #000)` }}>
                  <p className="text-xs opacity-70 mb-1">{acc.bank_name}</p>
                  <p className="font-semibold text-sm">
                    {acc.account_name}
                    {acc.account_number ? ` •••• ${acc.account_number}` : ''}
                  </p>
                  <p className="text-xs opacity-60 mt-1 mb-1">ยอดใช้จ่าย</p>
                  <p className="text-lg font-bold text-red-300">-{formatMoney(spent)}</p>
                  <p className="absolute top-3 right-3 text-xl opacity-20">💳</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* กราฟรายเดือน */}
      <MonthlyChart transactions={transactions} />

      {/* รายการล่าสุด */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">รายการล่าสุด</h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-2">📝</p>
            <p className="text-gray-500 text-sm">ยังไม่มีรายการ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">{tx.note || 'ไม่มีหมายเหตุ'}</p>
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
                <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddAccount && (
        <AddAccountModal session={session} onClose={() => setShowAddAccount(false)} onSuccess={fetchData} />
      )}
      {showAddTransaction && (
        <AddTransactionModal session={session} accounts={accounts} onClose={() => setShowAddTransaction(false)} onSuccess={fetchData} />
      )}

    </div>
  )
}
