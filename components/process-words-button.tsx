"use client"
import { useState } from "react"

export default function ProcessWordsButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function runProcess(dry = false) {
    setRunning(true)
    setResult(null)
    try {
      const url = `/api/words/process${dry ? "?dryRun=true" : ""}`
      const res = await fetch(url, { method: "POST" })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ error: String(e) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className="btn" onClick={() => runProcess(true)} disabled={running}>
          {running ? "Running..." : "Preview (dry run)"}
        </button>
        <button className="btn btn-primary" onClick={() => runProcess(false)} disabled={running}>
          {running ? "Running..." : "Process words"}
        </button>
      </div>
      {result && (
        <pre className="rounded border p-2 overflow-auto max-h-72">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}
