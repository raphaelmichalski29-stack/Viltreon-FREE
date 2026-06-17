import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      subscriptionStatus?: string
      accessDisabled?: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    subscriptionStatus?: string | null
    subscriptionEndsAt?: number | null
    accessDisabled?: boolean
    jti?: string
  }
}
