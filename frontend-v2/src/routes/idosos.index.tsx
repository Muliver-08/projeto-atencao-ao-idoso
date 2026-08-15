import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AvisoErro, Carregando, Enviando, Vazio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, mensagemDeErro } from "@/lib/api";
import { dataCurta } from "@/lib/formato";
import type { Idoso } from "@/lib/tipos";

export const Route = createFileRoute("/idosos/")({
  head: () => ({
    meta: [
      { title: "Idosos acompanhados — Diário de Medicação" },
      {
        name: "description",
        content:
          "Cadastre e acompanhe as pessoas idosas cuidadas pela família, com idade e observações de saúde.",
      },
      { property: "og:title", content: "Idosos acompanhados — Diário de Medicação" },
      {
        property: "og:description",
        content: "Cadastro de idosos com observações de saúde e acesso ao diário de medicação.",
      },
    ],
  }),
  component: PaginaIdosos,
});

function PaginaIdosos() {
  const [idosos, setIdosos] = useState<Idoso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    if (nome.trim().length < 3) return setErroForm("Escreva o nome completo do idoso.");
    if (!nascimento) return setErroForm("Informe a data de nascimento.");
    if (new Date(nascimento).getTime() > Date.now())
      return setErroForm("A data de nascimento não pode ser no futuro.");

    setEnviando(true);
    try {
      const criado = await api.criarIdoso({
        nome: nome.trim(),
        data_nascimento: nascimento,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      });
      setIdosos((a) => [...a, criado]);
      setNome("");
      setNascimento("");
      setObservacoes("");
      setMostrarForm(false);
      toast.success("Idoso cadastrado.");
    } catch (err) {
      setErroForm(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Idosos</h1>
        <Button size="lg" onClick={() => setMostrarForm((v) => !v)}>
          <Plus className="size-5" aria-hidden /> {mostrarForm ? "Fechar" : "Novo"}
        </Button>
      </div>

      {mostrarForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cadastrar idoso</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-base">
                  Nome completo
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={120}
                  className="h-12 text-base"
                  placeholder="Ex.: Maria Aparecida Souza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nasc" className="text-base">
                  Data de nascimento
                </Label>
                <Input
                  id="nasc"
                  type="date"
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs" className="text-base">
                  Observações de saúde (opcional)
                </Label>
                <Textarea
                  id="obs"
                  value={observacoes}
                  maxLength={500}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="min-h-24 text-base"
                  placeholder="Alergias, dificuldades, cuidados especiais..."
                />
              </div>
              {erroForm && <p className="text-base font-medium text-destructive">{erroForm}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={enviando}>
                {enviando ? <Enviando /> : "Salvar idoso"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {erro && (
        <AvisoErro
          mensagem={erro}
          acao={
            <Button variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {carregando ? (
        <Carregando />
      ) : idosos.length === 0 ? (
        <Vazio
          titulo="Nenhum idoso cadastrado"
          descricao="Toque em Novo para cadastrar o primeiro."
        />
      ) : (
        <ul className="space-y-3">
          {idosos.map((i) => (
            <li key={i.id}>
              <Link to="/idosos/$id" params={{ id: String(i.id) }} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-lg font-semibold">{i.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {i.idade} anos · nascido em {dataCurta(i.data_nascimento)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {i.cuidadores?.length ?? 0} cuidador(es) vinculado(s)
                      </p>
                    </div>
                    <ArrowRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
