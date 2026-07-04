import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-lg px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
