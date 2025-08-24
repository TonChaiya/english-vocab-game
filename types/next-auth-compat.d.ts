declare module "next-auth" {
  // Minimal compat shims for getServerSession and NextAuth types used in this project.
  export type NextAuthOptions = any

  export function getServerSession(...args: any[]): Promise<any>

  // NextAuth default export is callable in some usage patterns
  export default function NextAuth(...args: any[]): any
}

declare module "next-auth/react" {
  export * from "next-auth"
}
