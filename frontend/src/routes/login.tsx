import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Enviando } from "@/components/estados";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensagemDeErro } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import { emailValido } from "@/lib/formato";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Diário de Medicação" },
      { name: "description", content: "Entre com seu email e senha de cuidador." },
    ],
  }),
  component: PaginaLogin,
});

function PaginaLogin() {
  const { login } = useCuidador();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!emailValido(email)) return setErro("Informe um email válido.");
    if (!senha) return setErro("Informe sua senha.");
    setEnviando(true);
    try {
      await login(email.trim(), senha);
      await navigate({ to: "/" });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email e senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-base">
                Email
              </Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-senha" className="text-base">
                Senha
              </Label>
              <Input
                id="login-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-12 text-base"
                autoComplete="current-password"
              />
            </div>
            {erro && <p className="text-base font-medium text-destructive">{erro}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={enviando}>
              {enviando ? (
                <Enviando texto="Entrando..." />
              ) : (
                <>
                  <LogIn className="size-5" aria-hidden /> Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-base text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-semibold text-primary">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
