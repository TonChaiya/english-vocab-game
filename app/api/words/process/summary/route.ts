import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const WORDS_PER_STAGE = 100

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const client = await clientPromise
    const db = client.db()

    const levels: string[] = await db.collection("words").distinct("level")
    const summary: Record<string, any> = {}

    for (const level of levels) {
      const total = await db.collection("words").countDocuments({ level })
      const withSequence = await db.collection("words").countDocuments({ level, sequence: { $exists: true, $ne: null } } as any)
      const withStage = await db.collection("words").countDocuments({ level, stage: { $exists: true, $ne: null } } as any)
      const maxSeqDoc = await db.collection("words").find({ level, sequence: { $exists: true } } as any).sort({ sequence: -1 }).limit(1).toArray()
      const maxSequence = maxSeqDoc.length > 0 ? maxSeqDoc[0].sequence : null

      // sample up to 10 missing sequence examples
      const missingSequenceSamples = await db.collection("words").find({ level, $or: [{ sequence: { $exists: false } }, { sequence: null }] } as any).limit(10).toArray()
      const missingStageSamples = await db.collection("words").find({ level, $or: [{ stage: { $exists: false } }, { stage: null }] } as any).limit(10).toArray()

      summary[level] = {
        total,
        withSequence,
        withStage,
        maxSequence,
        expectedStages: Math.max(1, Math.ceil(total / WORDS_PER_STAGE)),
        missingSequenceSamples: JSON.parse(JSON.stringify(missingSequenceSamples)),
        missingStageSamples: JSON.parse(JSON.stringify(missingStageSamples)),
      }
    }

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    console.error("Process summary error:", error)
    return NextResponse.json({ error: "Internal" }, { status: 500 })
  }
}
