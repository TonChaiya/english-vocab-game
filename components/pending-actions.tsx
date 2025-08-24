"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PendingActions() {
  return (
    <div className="flex justify-center gap-3">
      <Link href="/">
        <Button variant="secondary">กลับไปหน้าหลัก</Button>
      </Link>

      <Button
        variant="destructive"
        onClick={() => {
          // redirect to NextAuth signout endpoint
          window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent('/')
        }}
      >
        ออกจากระบบ
      </Button>
    </div>
  )
}
