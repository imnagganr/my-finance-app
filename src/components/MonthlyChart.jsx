import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

export default function MonthlyChart({ transactions }) {
  // สร้างข้อมูลกราฟ 6 เดือนล่าสุด
  const data = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const month = d.getMonth()
    const year = d.getFullYear()

    const income = transactions
      .filter(t => {
        const td = new Date(t.date)
        return t.type === 'income' && td.getMonth() === month && td.getFullYear() === year
      })
      .reduce((s, t) => s + t.amount, 0)

    const expense = transactions
      .filter(t => {
        const td = new Date(t.date)
        return t.type === 'expense' && td.getMonth() === month && td.getFullYear() === year
      })
      .reduce((s, t) => s + t.amount, 0)

    return { name: MONTHS[month], รายรับ: income, รายจ่าย: expense }
  })

  const formatValue = (value) =>
    new Intl.NumberFormat('th-TH', { 
      style: 'currency', 
      currency: 'THB',
      minimumFractionDigits: 0 
    }).format(value)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <h2 className="font-semibold text-gray-700 mb-4">สรุปรายเดือน</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => formatValue(value)} />
          <Legend />
          <Bar dataKey="รายรับ" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="รายจ่าย" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}