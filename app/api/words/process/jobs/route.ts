import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const client = await clientPromise
    const db = client.db()
    const jobs = await db.collection("jobs").find({}).sort({ startedAt: -1 }).limit(50).toArray()
    return NextResponse.json({ ok: true, jobs: JSON.parse(JSON.stringify(jobs)) })
  } catch (error) {
    console.error("Jobs list error:", error)
    return NextResponse.json({ error: "Internal" }, { status: 500 })
  }
}
