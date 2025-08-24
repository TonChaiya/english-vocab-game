import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { GameInterface } from "@/components/game-interface"
import { getUserProgress } from "@/lib/user-progress"
import { getWordForUser, getLevelStats } from "@/lib/words"
import { redirect } from "next/navigation"
import clientPromise from '@/lib/mongodb'

export default async function GamePage({ searchParams }: any) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/")
  }

  // ถ้า session ระบุว่าเป็น pending ให้รีไดเร็กต์ทันทีโดยไม่ต้องรอ DB
  if (session.user && (session.user.confirmed === false || session.user.role === 'pending')) {
    redirect('/pending')
  }

  // ตรวจสอบสถานะผู้ใช้จากฐานข้อมูล (confirmed และ role)
  try {
    const client = await clientPromise
    const db = client.db()
    const userDoc = await db
      .collection('users')
      .findOne({ $or: [{ _id: session.user.id }, { email: session.user.email }] })

    // ถ้าไม่พบผู้ใช้ใน DB หรือผู้ใช้ยังไม่ถูกยืนยัน ให้รีไดเร็กต์ไปยัง /pending
    if (!userDoc || userDoc.confirmed === false) {
      console.log('Game page - user not confirmed or not found, redirecting to /pending', session.user.email)
      redirect('/pending')
    }

    // อนุญาตเข้าถึงเฉพาะ role 'user' หรือ 'admin'
    if (!(userDoc.role === 'user' || userDoc.role === 'admin')) {
      console.log('Game page - user role not allowed:', userDoc.role)
      redirect('/pending')
    }
  } catch (err) {
    console.error('Game page - error checking user status:', err)
    // ถ้าเกิดข้อผิดพลาดระหว่างเช็ค DB ให้รีไดเร็กต์ไปหน้าหลักเพื่อความปลอดภัย
    redirect('/')
  }

  // Get level and stage from URL parameters if provided
  // Resolve searchParams safely (it might be a Promise in Next runtime)
  const resolvedSearchParams = await Promise.resolve(searchParams)

  const levelParam = resolvedSearchParams?.level ? String(resolvedSearchParams.level) : undefined
  const stageParam = resolvedSearchParams?.stage ? parseInt(String(resolvedSearchParams.stage)) : undefined

  console.log(`Game page - URL parameters: level=${levelParam}, stage=${stageParam}`)

  const userId = session.user.id
  const progress = await getUserProgress(userId)
  const stats = await getLevelStats(userId)

  // If level and stage are provided in URL, override the progress
  if (levelParam && stageParam) {
    console.log(`Game page - Overriding progress with level=${levelParam}, stage=${stageParam}`)
    progress.currentLevel = levelParam
    progress.currentStage = stageParam
  }

  try {
    console.log(`Game page - Getting word for user with level=${progress.currentLevel}, stage=${progress.currentStage}`)
    const { word, choices } = await getWordForUser(userId, progress)

    return (
      <div className="flex justify-center min-h-[calc(100vh-4rem)]">
        <div className="container max-w-4xl py-10 px-4">
          <GameInterface
            initialWord={word}
            initialChoices={choices}
            userId={userId}
            progress={progress}
            stats={stats}
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error loading game:", error)

    return (
      <div className="flex justify-center min-h-[calc(100vh-4rem)]">
        <div className="container max-w-4xl py-10 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">เกิดข้อผิดพลาดในการโหลดเกม</h1>
          <p className="text-muted-foreground mb-6">ไม่สามารถโหลดคำศัพท์ได้ โปรดลองอีกครั้งในภายหลัง</p>
        </div>
      </div>
    )
  }
}
