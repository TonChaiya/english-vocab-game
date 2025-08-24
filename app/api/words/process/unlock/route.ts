import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db()

    // Release lock
    const res = await db.collection("jobs").updateOne({ _id: "process_words_lock" as any }, { $set: { locked: false, finishedAt: new Date(), unlockedBy: session.user.id } } as any)

    return NextResponse.json({ ok: true, modifiedCount: res.modifiedCount })
  } catch (error) {
    console.error("Process unlock error:", error)
    return NextResponse.json({ error: "Internal" }, { status: 500 })
  }
}
