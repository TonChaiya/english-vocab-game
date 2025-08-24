import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function escapeCsv(value: any) {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const level = url.searchParams.get('level')

    const client = await clientPromise
    const db = client.db()

    const filter: any = {}
    if (level) filter.level = level

    const cursor = db.collection('words').find(filter).sort({ level: 1, sequence: 1 })

    // CSV header
    const headers = ['_id','english','thai','level','sequence','stage','createdAt','updatedAt']
    const rows: string[] = []
    rows.push(headers.join(','))

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (!doc) continue
      const row = [
        escapeCsv(doc._id?.toString()),
        escapeCsv(doc.english),
        escapeCsv(doc.thai),
        escapeCsv(doc.level),
        escapeCsv(doc.sequence),
        escapeCsv(doc.stage),
        escapeCsv(doc.createdAt),
        escapeCsv(doc.updatedAt),
      ].join(',')
      rows.push(row)
    }

  // Prefix with UTF-8 BOM so Excel opens UTF-8 files correctly (Thai characters)
  const BOM = '\uFEFF'
  const csv = BOM + rows.join('\n')
  return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="words${level ? `-${level}` : ''}.csv"` } })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal' }, { status: 500 })
  }
}
