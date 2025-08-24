import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { id, sequence, stage } = body
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const client = await clientPromise
    const db = client.db()
    const res = await db.collection("words").updateOne({ _id: id as any }, { $set: { sequence, stage } } as any)

    // log job entry for this manual assign
    await db.collection("jobs").insertOne({ type: "assign_word", wordId: id, sequence, stage, owner: session.user.id, at: new Date() } as any)

    return NextResponse.json({ ok: true, modifiedCount: res.modifiedCount })
  } catch (error) {
    console.error("Assign error:", error)
    return NextResponse.json({ error: "Internal" }, { status: 500 })
  }
}
