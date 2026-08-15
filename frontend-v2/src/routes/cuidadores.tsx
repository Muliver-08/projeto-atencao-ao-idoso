import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AvisoErro, Carregando, Enviando, Vazio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, mensagemDeErro } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import { mascararTelefone, telefoneValido } from "@/lib/formato";
import type { Idoso } from "@/lib/tipos";

export const Route = createFileRoute("/cuidadores")({
  head: () => ({
    meta: [
      { title: "Cuidadores — Diário de Medicação" },
      {
        name: "description",
        content:
          "Cadastre os cuidadores da família e vincule cada um aos idosos que acompanha, sem senha nem login.",
      },
      { property: "og:title", content: "Cuidadores — Diário de Medicação" },
      {
        property: "og:description",
        content: "Cadastro de cuidadores e vínculo com os idosos acompanhados.",
      },
    ],
  }),
  component: PaginaCuidadores,
});

function PaginaCuidadores() {
  const { cuidadores, recarregar, erro: erroCtx } = useCuidador();
  const [idosos, setIdosos] = useState<Idoso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [vinculoCuidador, setVinculoCuidador] = useState("");
  const [vinculoIdoso, setVinculoIdoso] = useState("");
  const [vinculando, setVinculando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setIdosos(await api.listarIdosos());
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    if (nome.trim().length < 3) return setErroForm("Escreva o nome completo do cuidador.");
    if (!telefoneValido(telefone))
      return setErroForm("Telefone incompleto. Use o formato (11) 98888-7777.");
    setEnviando(true);
    try {
      await api.criarCuidador({ nome: nome.trim(), telefone: telefone.trim() });
      setNome("");
      setTelefone("");
      setMostrarForm(false);
      await recarregar();
      toast.success("Cuidador cadastrado.");
    } catch (err) {
      setErroForm(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  async function vincular() {
    if (!vinculoCuidador || !vinculoIdoso) return;
    setVinculando(true);
    try {
      await api.vincularCuidador(Number(vinculoIdoso), Number(vinculoCuidador));
      setVinculoCuidador("");
      setVinculoIdoso("");
      await carregar();
      toast.success("Vínculo criado.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Cuidadores</h1>
        <Button size="lg" onClick={() => setMostrarForm((v) => !v)}>
          <Plus className="size-5" aria-hidden /> {mostrarForm ? "Fechar" : "Novo"}
        </Button>
      </div>

      {mostrarForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cadastrar cuidador</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="c-nome" className="text-base">
                  Nome completo
                </Label>
                <Input
                  id="c-nome"
                  value={nome}
                  maxLength={120}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-12 text-base"
                  placeholder="Ex.: Ana Souza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-tel" className="text-base">
                  Telefone
                </Label>
                <Input
                  id="c-tel"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  className="h-12 text-base"
                  placeholder="(11) 98888-7777"
                />
              </div>
              {erroForm && <p className="text-base font-medium text-destructive">{erroForm}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={enviando}>
                {enviando ? <Enviando /> : "Salvar cuidador"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(erro || erroCtx) && (
        <AvisoErro
          mensagem={erro ?? erroCtx ?? ""}
          acao={
            <Button variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {carregando ? (
        <Carregando linhas={2} />
      ) : cuidadores.length === 0 ? (
        <Vazio
          titulo="Nenhum cuidador cadastrado"
          descricao="Cadastre quem cuida do idoso no dia a dia."
        />
      ) : (
        <ul className="space-y-3">
          {cuidadores.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="py-4">
                  <p className="text-lg font-semibold">{c.nome}</p>
                  <p className="flex items-center gap-1.5 text-base text-muted-foreground">
                    <Phone className="size-4" aria-hidden /> {c.telefone}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cuida de:{" "}
                    {idosos
                      .filter((i) => i.cuidadores?.some((x) => x.id === c.id))
                      .map((i) => i.nome)
                      .join(", ") || "nenhum idoso vinculado"}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vincular cuidador a um idoso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={vinculoCuidador} onValueChange={setVinculoCuidador}>
            <SelectTrigger className="h-12 text-base" aria-label="Escolher cuidador">
              <SelectValue placeholder="Escolher cuidador" />
            </SelectTrigger>
            <SelectContent>
              {cuidadores.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="text-base">
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vinculoIdoso} onValueChange={setVinculoIdoso}>
            <SelectTrigger className="h-12 text-base" aria-label="Escolher idoso">
              <SelectValue placeholder="Escolher idoso" />
            </SelectTrigger>
            <SelectContent>
              {idosos.map((i) => (
                <SelectItem key={i.id} value={String(i.id)} className="text-base">
                  {i.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="lg"
            className="w-full"
            disabled={!vinculoCuidador || !vinculoIdoso || vinculando}
            onClick={() => void vincular()}
          >
            {vinculando ? (
              <Enviando />
            ) : (
              <>
                <UserPlus className="size-5" aria-hidden /> Vincular
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
