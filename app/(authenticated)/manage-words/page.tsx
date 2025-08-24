import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import clientPromise from "@/lib/mongodb"
import { WordManager } from "@/components/word-manager"
import ProcessWordsButton from "@/components/process-words-button"
import WordsSummary from "@/components/words-summary"
import JobsList from "@/components/jobs-list"

export default async function ManageWordsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/")
  }

  // ดึงจำนวนคำศัพท์ในฐานข้อมูล
  const client = await clientPromise
  const db = client.db()
  const wordCount = await db.collection("words").countDocuments()

  // ดึงคำศัพท์ล่าสุด 10 คำ
  const recentWords = await db.collection("words").find({}).sort({ createdAt: -1 }).limit(10).toArray()

  // แปลง ObjectId เป็น string
  const serializedRecentWords = JSON.parse(JSON.stringify(recentWords))

  return (
    <div className="flex justify-center min-h-[calc(100vh-4rem)]">
      <div className="container max-w-4xl py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">จัดการคำศัพท์</h1>
        <div className="mb-6">
          {/* แสดงบทบาทผู้ใช้ฝั่งเซิร์ฟเวอร์ (debug) */}
          <div className="mb-2 text-sm text-muted-foreground">Server session role: {session?.user?.role ?? "(none)"}</div>

          {/* ปุ่มสำหรับประมวลผลลำดับคำและด่าน (admin) */}
          {session?.user?.role === "admin" ? (
            <div className="">
              {/* Top-level collapse for the whole admin panel */}
              <details className="p-3 border rounded">
                <summary className="cursor-pointer font-medium mb-2">Admin tools (click to show/hide)</summary>
                <div className="mt-2 space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <ProcessWordsButton />
                    </div>
                  </div>
                  <WordsSummary />
                  <JobsList />
                </div>
              </details>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">ปุ่มการประมวลผลจะแสดงเฉพาะผู้ดูแลระบบ (admin)</div>
          )}
        </div>
        <WordManager wordCount={wordCount} recentWords={serializedRecentWords} />
      </div>
    </div>
  )
}
