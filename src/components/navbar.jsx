import { supabase } from '../lib/supabase'

export default function Navbar({ session, page, setPage }) {
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="font-semibold text-gray-800">บัญชีรายรับรายจ่าย</span>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-red-500 hover:underline"
        >
          ออกจากระบบ
        </button>
      </div>

      <div className="max-w-2xl mx-auto flex border-t border-gray-100">
        <button
          onClick={() => setPage('dashboard')}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            page === 'dashboard'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🏠 หน้าหลัก
        </button>
        <button
          onClick={() => setPage('budget')}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            page === 'budget'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🎯 งบประมาณ
        </button>

        <button
          onClick={() => setPage('transactions')}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            page === 'transactions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 รายการ
        </button>
        
      </div>
    </div>
  )
}