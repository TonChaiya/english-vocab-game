"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function WordsSummary() {
  const [loading, setLoading] = useState(false)
  const [globalCollapsed, setGlobalCollapsed] = useState(false)
  const [data, setData] = useState<any>(null)
  const [collapsedLevels, setCollapsedLevels] = useState<Record<string, boolean>>({})
  const [csvUrl, setCsvUrl] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/words/process/summary")
      const json = await res.json()
      setData(json)
  // initialize per-level collapsed state (false = expanded)
  const map: Record<string, boolean> = {}
  Object.keys(json.summary || {}).forEach((l) => { map[l] = false })
  setCollapsedLevels(map)
    } catch (e) {
      setData({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading summary...</div>
  if (!data) return null
  if (data.error) return <div className="text-destructive">Error: {String(data.error)}</div>

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold mb-2">Words Summary</h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => {
            const next = !globalCollapsed
            setGlobalCollapsed(next)
            const map: Record<string, boolean> = {}
            Object.keys(data?.summary || {}).forEach((l) => { map[l] = next })
            setCollapsedLevels(map)
          }}>{globalCollapsed ? 'Show all' : 'Collapse all'}</Button>
          <a href="/api/words/export"><Button variant="outline">Download all CSV</Button></a>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </div>
      <h2 className="font-semibold mb-2">Summary per level</h2>
      <div className="grid grid-cols-1 gap-4">
  {Object.entries(data.summary || {}).map(([level, info]: any) => (
          <div key={level} className="p-3 border rounded">
            <div className="flex justify-between mb-2">
              <div className="font-medium">Level {level}</div>
              <div className="text-sm text-muted-foreground">max sequence: {info.maxSequence ?? "-"}</div>
            </div>
            <div className="text-sm">Total: {info.total}, withSequence: {info.withSequence}, withStage: {info.withStage}</div>
            <div className="text-sm">Expected stages: {info.expectedStages}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // download CSV for this level
                  const rows = (data.summary[level].missingSequenceSamples || []).map((w: any) => ({ _id: w._id, english: w.english, thai: w.thai }))
                  if (!rows || rows.length === 0) return
                  const headers = Object.keys(rows[0])
                  const csv = [headers.join(','), ...rows.map((r: any) => headers.map(h => {
                    const v = (r[h] ?? '')
                    const s = String(v).replace(/"/g, '""')
                    return (s.includes(',') || s.includes('\n')) ? `"${s}"` : s
                  }).join(','))].join('\n')
                  // include BOM so Excel detects UTF-8 correctly for Thai text
                  const bom = '\uFEFF'
                  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" })
                  const url = URL.createObjectURL(blob)
                  setCsvUrl(url)
                }}
              >
                ดาวน์โหลด CSV ตัวอย่างที่ขาด
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>รีเฟรช</Button>
            </div>
            {info.missingSequenceSamples && info.missingSequenceSamples.length > 0 && (
              <details className="mt-2 text-sm" open={! (collapsedLevels[level] ?? globalCollapsed)}>
                <summary className="cursor-pointer">Missing sequence samples ({info.missingSequenceSamples.length})</summary>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(info.missingSequenceSamples.map((w: any) => ({ _id: w._id, english: w.english })), null, 2)}</pre>
              </details>
            )}
            {info.missingStageSamples && info.missingStageSamples.length > 0 && (
              <details className="mt-2 text-sm" open={! (collapsedLevels[level] ?? globalCollapsed)}>
                <summary className="cursor-pointer">Missing stage samples ({info.missingStageSamples.length})</summary>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(info.missingStageSamples.map((w: any) => ({ _id: w._id, english: w.english })), null, 2)}</pre>
              </details>
            )}
            <div className="mt-2">
              <button className="btn btn-outline btn-sm" onClick={() => setCollapsedLevels(prev => ({ ...prev, [level]: !(prev[level] ?? false) }))}>
                {collapsedLevels[level] ? 'Show' : 'Hide'} samples
              </button>
            </div>
          </div>
        ))}
      </div>
      {csvUrl && (
        <div className="mt-3">
          <a className="underline" href={csvUrl} download={`missing_sequence_samples.csv`}>ดาวน์โหลดไฟล์ CSV</a>
        </div>
      )}
    </div>
  )
}
