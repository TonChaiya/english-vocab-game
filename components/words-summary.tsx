"use client"
import { useEffect, useState } from "react"

export default function WordsSummary() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/words/process/summary")
      const json = await res.json()
      setData(json)
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
            {info.missingSequenceSamples && info.missingSequenceSamples.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">Missing sequence samples ({info.missingSequenceSamples.length})</summary>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(info.missingSequenceSamples.map((w: any) => ({ _id: w._id, english: w.english })), null, 2)}</pre>
              </details>
            )}
            {info.missingStageSamples && info.missingStageSamples.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">Missing stage samples ({info.missingStageSamples.length})</summary>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(info.missingStageSamples.map((w: any) => ({ _id: w._id, english: w.english })), null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
