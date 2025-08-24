import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db()
    const lock = await db.collection("jobs").findOne({ _id: "process_words_lock" as any })

    if (!lock) return NextResponse.json({ ok: true, exists: false })
    return NextResponse.json({ ok: true, lock })
  } catch (error) {
    console.error("Process status error:", error)
    return NextResponse.json({ error: "Internal" }, { status: 500 })
  }
}
