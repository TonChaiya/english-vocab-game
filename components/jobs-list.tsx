"use client"
import { useEffect, useState } from "react"

export default function JobsList() {
  const [jobs, setJobs] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/words/process/jobs')
      const json = await res.json()
      if (json.ok) setJobs(json.jobs)
    } catch (e) {
      console.error(e)
      setJobs([])
    } finally { setLoading(false) }
  }

  return (
    <div className="mt-4">
      <details>
        <summary className="font-medium cursor-pointer">Recent jobs (click to show)</summary>
        <div className="mt-2">
          {jobs === null ? (
            <div>
              <button className="btn btn-sm" onClick={load}>Load recent jobs</button>
            </div>
          ) : loading ? <div>Loading jobs...</div> : (
            <div className="space-y-2 text-sm">
              {jobs.map(j => (
                <div key={j._id} className="p-2 border rounded">
                  <div className="flex justify-between">
                    <div>{j.type} - {j.owner}</div>
                    <div className="text-muted-foreground">{new Date(j.startedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-xs mt-1">status: {j.status ?? j.finishedAt ? 'finished' : 'running'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
