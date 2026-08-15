import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Enviando } from "@/components/estados";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, mensagemDeErro } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import { emailValido, mascararTelefone, telefoneValido } from "@/lib/formato";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Diário de Medicação" },
      {
        name: "description",
        content: "Cadastre-se como cuidador com nome, telefone, email e senha.",
      },
    ],
  }),
  component: PaginaCadastro,
});

function PaginaCadastro() {
  const { login } = useCuidador();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 1) return setErro("Escreva seu nome completo.");
    if (!telefoneValido(telefone))
      return setErro("Telefone incompleto. Use o formato (11) 98888-7777.");
    if (!emailValido(email)) return setErro("Informe um email válido.");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");

    setEnviando(true);
    try {
      await api.criarCuidador({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        senha,
      });
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
      <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do cuidador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="cad-nome" className="text-base">
                Nome completo
              </Label>
              <Input
                id="cad-nome"
                value={nome}
                maxLength={120}
                onChange={(e) => setNome(e.target.value)}
                className="h-12 text-base"
                placeholder="Ex.: Ana Souza"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-tel" className="text-base">
                Telefone
              </Label>
              <Input
                id="cad-tel"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                className="h-12 text-base"
                placeholder="(11) 98888-7777"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-email" className="text-base">
                Email
              </Label>
              <Input
                id="cad-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cad-senha" className="text-base">
                Senha
              </Label>
              <Input
                id="cad-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-12 text-base"
                placeholder="Pelo menos 8 caracteres"
                autoComplete="new-password"
              />
            </div>
            {erro && <p className="text-base font-medium text-destructive">{erro}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={enviando}>
              {enviando ? (
                <Enviando texto="Cadastrando..." />
              ) : (
                <>
                  <UserPlus className="size-5" aria-hidden /> Criar conta
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-base text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </div>
  );
}
