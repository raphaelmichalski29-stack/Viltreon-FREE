"use client"

import Image from "next/image"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

async function handleSignOut() {
  try {
    await fetch("/api/auth/invalidate", { method: "POST" })
  } catch {
    // Silently continue — blacklist is best-effort
  }
  signOut({ callbackUrl: "/" })
}

/**
 * Unified dashboard header — matches the landing page nav. Spans the full
 * width of the viewport above both the sidebar and the main content. Contains
 * the brand mark on the left and theme toggle + user menu on the right.
 * Per-section navigation lives in the Sidebar below this header.
 */
export function TopBar() {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo-circle.png"
            alt="Viltreon"
            width={32}
            height={32}
            className="invert"
            unoptimized
          />
          <span className="font-mono text-sm font-medium tracking-tight">viltreon_</span>
        </Link>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback>
                    {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{session?.user?.name}</DropdownMenuLabel>
              {session?.user?.email && (
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground -mt-1">
                  {session.user.email}
                </DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
