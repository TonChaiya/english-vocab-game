import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from 'mongodb'

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  debug: process.env.NODE_ENV === "development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "consent",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
  ],
  callbacks: {
  session: async ({ session, token, user }: { session: any; token: any; user: any }) => {
      if (session?.user) {
        // ใช้ token.sub สำหรับ JWT strategy
        if (token?.sub) {
          session.user.id = token.sub
          // เพิ่มการส่งต่อรูปภาพจาก token
          session.user.image = token.picture || session.user.image
        }
        // ใช้ user.id สำหรับ database strategy
        else if (user?.id) {
          session.user.id = user.id
          // เพิ่มการส่งต่อรูปภาพจาก user
          session.user.image = user.image || session.user.image
        }

        try {
          // Check if user is admin
          const client = await clientPromise
          const db = client.db()
          const userId = token?.sub || user?.id

          console.log("Server Checking admin status for user:", userId)

          // prepare id query: try to use ObjectId when possible, otherwise fall back to raw id
          let idQuery: any = userId
          try {
            if (userId) idQuery = new ObjectId(String(userId))
          } catch (e) {
            idQuery = userId
          }

          // ตรวจสอบว่าผู้ใช้เป็น admin หรือไม่
          // ถ้าไม่มีผู้ใช้ที่เป็น admin ให้กำหนดผู้ใช้แรกเป็น admin
          const adminCount = await db.collection("users").countDocuments({ role: "admin" })
          console.log("Server Admin count:", adminCount)

          if (adminCount === 0) {
            // ถ้าไม่มี admin ให้กำหนดผู้ใช้นี้เป็น admin
            console.log("Server No admin found, setting current user as admin")

            // ทำการอัปเดตผู้ใช้เป็น admin (พยายาม match ทั้ง _id และ email)
            const updateResult = await db
              .collection("users")
              .updateOne(
                { $or: [{ _id: idQuery }, { email: session.user.email }] },
                { $set: { role: "admin", confirmed: true } }
              )

            console.log(
              "Server Update result:",
              updateResult.matchedCount,
              "documents matched,",
              updateResult.modifiedCount,
              "documents modified",
            )

            if (updateResult.modifiedCount > 0) {
              session.user.role = "admin"
              console.log("Server User set as admin:", userId)
            } else {
              console.log("Server Failed to set user as admin. No documents were modified.")

              // ลองใช้วิธีอื่นในการค้นหาผู้ใช้ (อีกครั้งโดยระบุ email)
              const user = await db.collection("users").findOne({ email: session.user.email })
              if (user) {
                console.log("Server Found user by email:", user._id)
                const updateByEmailResult = await db
                  .collection("users")
                  .updateOne({ _id: user._id }, { $set: { role: "admin", confirmed: true } })
                console.log(
                  "Server Update by email result:",
                  updateByEmailResult.matchedCount,
                  "documents matched,",
                  updateByEmailResult.modifiedCount,
                  "documents modified",
                )

                if (updateByEmailResult.modifiedCount > 0) {
                  session.user.role = "admin"
                  console.log("Server User set as admin by email lookup")
                }
              }
            }
          } else {
            // ตรวจสอบและเตรียมสถานะ confirmed
            // Try to find the user by _id (ObjectId-aware) or email
            const userDoc = await db.collection("users").findOne({ $or: [{ _id: idQuery }, { email: session.user.email }] })
            console.log("Server User document:", userDoc)

            // If the user document has no confirmed flag, set it to false by default
            if (userDoc && typeof userDoc.confirmed === 'undefined') {
              await db.collection('users').updateOne({ $or: [{ _id: idQuery }, { email: session.user.email }] }, { $set: { confirmed: false } })
              userDoc.confirmed = false
            }

            // If the user is admin in DB, treat as admin and ensure confirmed
            if (userDoc?.role === "admin") {
              session.user.role = "admin"
              session.user.confirmed = true
              console.log("Server User is admin:", userId)
            } else if (userDoc?.confirmed) {
              // regular confirmed user
              session.user.role = userDoc.role || 'user'
              session.user.confirmed = true
              console.log("Server User is confirmed user:", userId)
            } else {
              // not confirmed yet — mark as pending
              session.user.role = 'pending'
              session.user.confirmed = false
              console.log("Server User is pending confirmation:", userId)
            }
          }
        } catch (error) {
          console.error("Server Error checking admin status:", error)
        }
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/", // ใช้หน้าแรกเป็นหน้าล็อกอิน
  },
  session: {
    strategy: "jwt", // ใช้ JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 วัน
  },
}
