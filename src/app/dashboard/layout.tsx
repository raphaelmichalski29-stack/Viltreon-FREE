import { Sidebar } from "@/components/dashboard/sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { SubscriptionGuard } from "@/components/dashboard/subscription-guard"
import "@/components/dashboard/dashboard-shell.css"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SubscriptionGuard>
      <div className="vlt-app flex flex-col h-screen">
        {/* Shared aurora backdrop — fixed, sits behind the translucent chrome */}
        <div className="vlt-app__bg" aria-hidden="true">
          <div className="vlt-app__grid" />
          <div className="vlt-app__blob vlt-app__blob--a" />
          <div className="vlt-app__blob vlt-app__blob--b" />
          <div className="vlt-app__blob vlt-app__blob--c" />
        </div>
        {/* Full-width header across the top, spans above both sidebar and main */}
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SubscriptionGuard>
  )
}
