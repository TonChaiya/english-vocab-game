import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const WORDS_PER_STAGE = 100
const BATCH_SIZE = 500

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const dryRun = url.searchParams.get("dryRun") === "true"

  const client = await clientPromise
  const db = client.db()

  // Create a job record for audit
  const jobDoc: any = { type: "process_words", owner: session.user.id, dryRun, status: "running", startedAt: new Date() }
  const jobInsert = await db.collection("jobs").insertOne(jobDoc as any)
  const jobId = jobInsert.insertedId

    // Acquire a simple lock to prevent concurrent runs
    // Acquire lock safely: try insert, if duplicate key then try conditional update
    let acquired = false
    try {
      await db.collection("jobs").insertOne({ _id: "process_words_lock" as any, locked: true, owner: session.user.id, startedAt: new Date() } as any)
      acquired = true
    } catch (err: any) {
      // Duplicate key means document exists; try to acquire only if not locked
      if (err && (err.code === 11000 || String(err).includes("E11000"))) {
        const res = await db.collection("jobs").updateOne({ _id: "process_words_lock" as any, locked: { $ne: true } } as any, { $set: { locked: true, owner: session.user.id, startedAt: new Date() } } as any)
        if (res.modifiedCount && res.modifiedCount > 0) {
          acquired = true
        }
      } else {
        throw err
      }
    }

    if (!acquired) {
      return NextResponse.json({ error: "Processing already in progress" }, { status: 409 })
    }

    const levels: string[] = await db.collection("words").distinct("level")
    const summary: Record<string, any> = { levels: {}, totalAssigned: 0, totalUpdated: 0 }

  for (const level of levels) {
      // iterate in deterministic order
      const cursor = db
        .collection("words")
        .find({ level })
        .project({ _id: 1 })
        .sort({ createdAt: 1, english: 1 })

      let seq = 0
      let batchOps: any[] = []
      let assigned = 0
      let updated = 0

      while (await cursor.hasNext()) {
        const doc = await cursor.next()
        if (!doc) continue
        seq += 1
        const stage = Math.ceil(seq / WORDS_PER_STAGE)

        assigned += 1

        if (!dryRun) {
          batchOps.push({
            updateOne: {
                filter: { _id: (doc._id as any) },
                update: { $set: { sequence: seq, stage } },
              },
          })
        }

        if (batchOps.length >= BATCH_SIZE) {
          if (!dryRun) {
            const res = await db.collection("words").bulkWrite(batchOps)
            updated += (res.modifiedCount ?? 0) + (res.upsertedCount ?? 0)
          }
          batchOps = []
        }
      }

      if (batchOps.length > 0 && !dryRun) {
        const res = await db.collection("words").bulkWrite(batchOps)
        updated += (res.modifiedCount ?? 0) + (res.upsertedCount ?? 0)
      }

  summary.levels[level] = { assigned, updated, lastSequence: seq, stages: Math.max(1, Math.ceil(seq / WORDS_PER_STAGE)) }
  // optional incremental job progress could be added here
      summary.totalAssigned += assigned
      summary.totalUpdated += updated
    }

    // Release lock
  await db.collection("jobs").updateOne({ _id: "process_words_lock" as any }, { $set: { locked: false, finishedAt: new Date() } } as any)

    return NextResponse.json({ ok: true, summary, dryRun })
  } catch (error) {
    console.error("Process words error:", error)
    try {
      const client = await clientPromise
      const db = client.db()
  await db.collection("jobs").updateOne({ _id: "process_words_lock" as any }, { $set: { locked: false, finishedAt: new Date(), error: String(error) } } as any)
    } catch (e) {
      console.error("Failed to release lock:", e)
    }
    return NextResponse.json({ error: "Internal Server Error", detail: String(error) }, { status: 500 })
  }
}
