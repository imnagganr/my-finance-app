import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setMessage(error.message)
      else setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้วครับ!')
    } else if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมล')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 
                    flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-gray-800">บัญชีรายรับรายจ่าย</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isForgot ? 'รีเซ็ตรหัสผ่าน' : isRegister ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com"
              required
            />
          </div>

          {!isForgot && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {message && (
            <div className={`text-sm p-3 rounded-lg ${
              message.includes('สำเร็จ') || message.includes('ส่งลิงก์')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white 
                       font-semibold py-2.5 rounded-lg transition
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'กำลังโหลด...' : isForgot ? 'ส่งลิงก์รีเซ็ต' : isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* ลืมรหัสผ่าน */}
        {!isRegister && !isForgot && (
          <p className="text-center text-sm text-gray-500 mt-3">
            <button
              onClick={() => { setIsForgot(true); setMessage('') }}
              className="text-blue-600 hover:underline"
            >
              ลืมรหัสผ่าน?
            </button>
          </p>
        )}

        {/* Toggle Register/Login */}
        {!isForgot && (
          <p className="text-center text-sm text-gray-500 mt-3">
            {isRegister ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?'}
            <button
              onClick={() => { setIsRegister(!isRegister); setMessage('') }}
              className="text-blue-600 font-medium ml-1 hover:underline"
            >
              {isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </p>
        )}

        {/* กลับไปหน้า Login */}
        {isForgot && (
          <p className="text-center text-sm text-gray-500 mt-3">
            <button
              onClick={() => { setIsForgot(false); setMessage('') }}
              className="text-blue-600 hover:underline"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </button>
          </p>
        )}

      </div>
    </div>
  )
}