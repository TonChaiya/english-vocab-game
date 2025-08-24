import type React from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Header } from "@/components/header"
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/")
  }

  // If session explicitly marks user as pending/unconfirmed, redirect immediately
  if (session.user && (session.user.confirmed === false || session.user.role === 'pending')) {
    redirect('/pending')
  }

  // Fetch authoritative user document from DB to check confirmed status and role
  try {
    const client = await clientPromise
    const db = client.db()
    // Try to query by ObjectId when session.user.id is an ObjectId-like string
    let idQuery: any = session.user.id
    try {
      if (session.user?.id) idQuery = new ObjectId(String(session.user.id))
    } catch (e) {
      idQuery = session.user.id
    }

    const userDoc = await db
      .collection("users")
      .findOne({ $or: [{ _id: idQuery }, { email: session.user.email }] })

    // If the user exists in DB and is not confirmed, redirect to the pending page
    if (userDoc && userDoc.confirmed === false) {
      redirect('/pending')
    }

    // Use DB role when available so header reflects authoritative role
    const headerUser = {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: (userDoc && userDoc.role) || session.user.role,
    }

    return (
      <div className="flex min-h-screen flex-col">
        <Header user={headerUser} />
        <main className="flex-1">{children}</main>
      </div>
    )
  } catch (error) {
    // If DB check fails for some reason, fall back to session user
    console.error('Error checking user confirmation status:', error)
    return (
      <div className="flex min-h-screen flex-col">
        <Header user={session.user} />
        <main className="flex-1">{children}</main>
      </div>
    )
  }
}
