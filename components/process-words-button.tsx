"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"

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

  function downloadJson(data: any, filename = "preview.json") {
    const url = `data:application/json,${encodeURIComponent(JSON.stringify(data))}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  function downloadCsvFromSamples(samples: any[], filename = 'preview.csv') {
    if (!samples || samples.length === 0) return
    const headers = ['_id','english','thai','level','sequence','stage']
    const rows = samples.map(s => headers.map(h => {
      const v = s[h] ?? s[h === '_id' ? 'id' : h] ?? ''
      const str = String(v).replace(/"/g, '""')
      return (str.includes(',') || str.includes('\n')) ? `"${str}"` : str
    }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
  // include BOM so Excel detects UTF-8 correctly
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => runProcess(true)} disabled={running}>
          {running ? "Running..." : "Preview (dry run)"}
        </Button>
        <Button variant="secondary" onClick={() => runProcess(false)} disabled={running}>
          {running ? "Running..." : "Process words"}
        </Button>
      </div>
      {result && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-medium">Preview result</div>
            <button className="btn btn-sm" onClick={() => downloadJson(result, 'process-preview.json')}>Download JSON</button>
            <button className="btn btn-sm" onClick={() => {
              const samples = result.sample || result.previewSample || result.summary?.sample || []
              downloadCsvFromSamples(samples, 'process-preview.csv')
            }}>Download CSV</button>
          </div>
          <pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
