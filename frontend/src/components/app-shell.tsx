import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Clock,
  HeartHandshake,
  Home,
  LogOut,
  Moon,
  Sun,
  UserRound,
  Users,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { estaEmModoDemo, observarModoDemo } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import { Button } from "@/components/ui/button";

const ITENS = [
  { to: "/", rotulo: "Início", Icone: Home },
  { to: "/idosos", rotulo: "Idosos", Icone: UserRound },
  { to: "/convites", rotulo: "Convites", Icone: Users },
  { to: "/historico", rotulo: "Histórico", Icone: Clock },
] as const;

function BotaoTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem("tema");
    const preferido = salvo
      ? salvo === "escuro"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setEscuro(preferido);
    document.documentElement.classList.toggle("dark", preferido);
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem("tema", novo ? "escuro" : "claro");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      className="size-11 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
    >
      {escuro ? <Sun className="size-6" /> : <Moon className="size-6" />}
    </Button>
  );
}

function CuidadorLogado() {
  const { cuidadorAtual, carregando, logout } = useCuidador();
  const navigate = useNavigate();

  if (carregando || !cuidadorAtual) return null;

  async function sair() {
    await logout();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-sm font-medium text-primary-foreground/80">
        Olá, <strong className="font-semibold text-primary-foreground">{cuidadorAtual.nome}</strong>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void sair()}
        className="h-9 gap-1.5 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
      >
        <LogOut className="size-4" aria-hidden /> Sair
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [demo, setDemo] = useState(estaEmModoDemo());
  useEffect(() => {
    const parar = observarModoDemo(setDemo);
    return () => {
      parar();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                <HeartHandshake className="size-6" aria-hidden />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-xl font-bold tracking-tight">zelo</span>
                <span className="text-xs font-medium text-primary-foreground/80">
                  tranquilidade para quem cuida
                </span>
              </span>
            </Link>
            <BotaoTema />
          </div>
          <CuidadorLogado />
        </div>
        {demo && (
          <div className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-sm font-medium text-warning-foreground">
            <WifiOff className="size-4" aria-hidden />
            Dados de exemplo — o servidor não está respondendo agora.
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">{children}</main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card"
      >
        <ul className="mx-auto flex w-full max-w-3xl">
          {ITENS.map(({ to, rotulo, Icone }) => {
            const ativo = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to} className="flex-1 py-2">
                <Link
                  to={to}
                  aria-current={ativo ? "page" : undefined}
                  className={`mx-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-semibold transition-colors ${
                    ativo ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icone className="size-6" aria-hidden />
                  {rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
