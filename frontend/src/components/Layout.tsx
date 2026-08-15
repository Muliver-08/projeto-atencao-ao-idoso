import { Link, Outlet } from "react-router"

import { SeletorCuidador } from "@/components/SeletorCuidador"

const linkClasses =
  "rounded-lg px-3 py-2 text-base font-medium text-primary-foreground/90 transition-colors hover:bg-white/15 hover:text-primary-foreground"

export default function Layout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="bg-primary">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="mr-2 text-lg font-semibold text-primary-foreground"
            >
              Atenção ao Idoso
            </Link>
            <nav className="flex gap-1">
              <Link className={linkClasses} to="/idosos">
                Idosos
              </Link>
              <Link className={linkClasses} to="/cuidadores">
                Cuidadores
              </Link>
            </nav>
          </div>
          <SeletorCuidador />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
