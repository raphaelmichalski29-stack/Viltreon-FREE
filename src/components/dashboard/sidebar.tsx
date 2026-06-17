"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, BookOpen, Settings, Bug } from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/labels", label: "Inbox Rules", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r flex flex-col">
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3",
                pathname === item.href && "bg-accent text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <a
          href={process.env.NEXT_PUBLIC_BUG_REPORT_URL || "mailto:support@viltreon.com?subject=Bug%20report"}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
            <Bug className="h-4 w-4" />
            Report a bug
          </Button>
        </a>
      </div>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Powered by AI
      </div>
    </aside>
  )
}
