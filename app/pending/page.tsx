import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import PendingActions from '@/components/pending-actions'
// note: this is a server component, avoid importing client-side signOut here

export default async function PendingPage() {
  const session = await getServerSession(authOptions)

  // ถ้ามีอีเมลแอดมินใน env เราจะแสดงลิงก์ติดต่อ หากไม่มี ใช้ข้อความทั่วไป
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ""

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 dark:bg-slate-900">
      <div className="max-w-xl p-8 bg-white rounded-lg shadow-lg border border-gray-100 text-center dark:bg-slate-800 dark:border-slate-700">
        <h1 className="text-2xl font-bold mb-4 text-foreground dark:text-white">สถานะ: รอตรวจสอบ</h1>
        <p className="mb-4 text-muted-foreground dark:text-slate-300">บัญชีของคุณได้รับการบันทึกแล้ว แต่ยังรอการยืนยันจากแอดมินก่อนจะสามารถเข้าเล่นเกมได้</p>
        <p className="mb-4 text-muted-foreground dark:text-slate-300">โปรดรอการติดต่อจากแอดมิน หากต้องการติดต่อเราทันที ให้ส่งอีเมลไปที่</p>
        {adminEmail ? (
          <p className="mb-4">
            <a className="text-blue-600 underline dark:text-blue-400" href={`mailto:${adminEmail}`}>{adminEmail}</a>
          </p>
        ) : (
          <p className="mb-4 text-muted-foreground dark:text-slate-300">โปรดติดต่อแอดมินของระบบ</p>
        )}

        <div className="flex justify-center gap-3">
          <PendingActions />
        </div>
      </div>
    </div>
  )
}
