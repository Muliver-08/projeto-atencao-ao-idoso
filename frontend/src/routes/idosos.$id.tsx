import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  Info,
  LogOut,
  Pill,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AvisoErro, Carregando, Enviando, Vazio } from "@/components/estados";
import { Historico } from "@/components/historico";
import { ModalConfirmarDose, ModalDoseJaConfirmada, ModalRiscoAlto } from "@/components/dose-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, api, mensagemDeErro } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import { dataHora, emailValido, hora, horaValida } from "@/lib/formato";
import type {
  Cuidador,
  Dose,
  EventoVinculo,
  Idoso,
  Interacao,
  Medicamento,
  NovoMedicamento,
} from "@/lib/tipos";

export const Route = createFileRoute("/idosos/$id")({
  head: () => ({
    meta: [
      { title: "Diário do idoso — medicamentos e doses" },
      {
        name: "description",
        content:
          "Medicamentos ativos, próximo horário, confirmação de dose sem duplicidade e histórico completo do idoso.",
      },
      { property: "og:title", content: "Diário do idoso — medicamentos e doses" },
      {
        property: "og:description",
        content: "Confirme doses em poucos toques e veja quem já confirmou cada horário.",
      },
    ],
  }),
  component: DetalheIdoso,
});

function DetalheIdoso() {
  const { id } = Route.useParams();
  const idosoId = Number(id);
  const { cuidadorAtual } = useCuidador();

  const [idoso, setIdoso] = useState<Idoso | null>(null);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [eventosVinculo, setEventosVinculo] = useState<EventoVinculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [i, m, d, ev] = await Promise.all([
        api.obterIdoso(idosoId),
        api.listarMedicamentos(idosoId),
        api.listarDoses(idosoId),
        api.listarHistoricoVinculo(idosoId),
      ]);
      setIdoso(i);
      setMedicamentos(m);
      setDoses(d);
      setEventosVinculo(ev);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, [idosoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) return <Carregando linhas={4} />;

  if (erro && !idoso) {
    return (
      <AvisoErro
        mensagem={erro}
        acao={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/idosos">Voltar</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (!idoso)
    return <Vazio titulo="Idoso não encontrado" descricao="Volte e escolha outro idoso." />;

  const atrasados = medicamentos.filter((m) => m.atrasado).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{idoso.nome}</h1>
        <p className="text-muted-foreground">{idoso.idade} anos</p>
        {idoso.observacoes && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-base">{idoso.observacoes}</p>
        )}
        {atrasados > 0 && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-base font-semibold text-destructive-foreground">
            <AlarmClock className="size-5" aria-hidden /> {atrasados} dose(s) atrasada(s)
          </p>
        )}
      </header>

      <Tabs defaultValue="medicamentos">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="medicamentos" className="text-sm">
            Remédios
          </TabsTrigger>
          <TabsTrigger value="novo" className="text-sm">
            Cadastrar
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-sm">
            Histórico
          </TabsTrigger>
          <TabsTrigger value="cuidadores" className="text-sm">
            Cuidadores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medicamentos" className="mt-4">
          <AbaMedicamentos
            medicamentos={medicamentos}
            cuidadorAtual={cuidadorAtual}
            aoAtualizar={carregar}
          />
        </TabsContent>

        <TabsContent value="novo" className="mt-4">
          <FormMedicamento idosoId={idosoId} medicamentos={medicamentos} aoSalvar={carregar} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Historico doses={doses} medicamentos={medicamentos} eventosVinculo={eventosVinculo} />
        </TabsContent>

        <TabsContent value="cuidadores" className="mt-4">
          <AbaCuidadores idoso={idoso} cuidadorAtual={cuidadorAtual} aoAtualizar={carregar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- medicamentos + confirmação de dose ---------- */

function AbaMedicamentos({
  medicamentos,
  cuidadorAtual,
  aoAtualizar,
}: {
  medicamentos: Medicamento[];
  cuidadorAtual: Cuidador | null;
  aoAtualizar: () => Promise<void>;
}) {
  const [selecionado, setSelecionado] = useState<Medicamento | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [duplicada, setDuplicada] = useState<{ dose: Dose | null; mensagem: string } | null>(null);

  async function confirmar(observacao: string) {
    if (!selecionado) return;
    setEnviando(true);
    try {
      await api.confirmarDose(selecionado.id, observacao || undefined);
      setSelecionado(null);
      toast.success("Dose confirmada.");
      await aoAtualizar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setSelecionado(null);
        setDuplicada({ dose: e.dose ?? null, mensagem: e.message });
      } else {
        toast.error(mensagemDeErro(e));
      }
    } finally {
      setEnviando(false);
    }
  }

  async function remover(m: Medicamento) {
    try {
      await api.removerMedicamento(m.id);
      toast.success(`${m.nome} foi inativado. O histórico continua salvo.`);
      await aoAtualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  if (medicamentos.length === 0) {
    return (
      <Vazio
        titulo="Nenhum remédio ativo"
        descricao="Use a aba Cadastrar para adicionar o primeiro medicamento."
      />
    );
  }

  return (
    <div className="space-y-3">
      {!cuidadorAtual && (
        <Alert className="border-warning bg-warning/10 text-base">
          <Info className="size-5" />
          <AlertTitle>Faça login para confirmar doses</AlertTitle>
          <AlertDescription>
            A confirmação de dose só é liberada depois que você entrar na sua conta.
          </AlertDescription>
        </Alert>
      )}

      {medicamentos.map((m) => (
        <Card key={m.id} className={m.atrasado ? "border-2 border-destructive" : undefined}>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Pill className="size-5 text-primary" aria-hidden /> {m.nome}
                </p>
                <p className="text-base text-muted-foreground">
                  {m.principio_ativo} · {m.dosagem} · a cada {m.frequencia_horas}h
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-base">
                  <Clock className="size-4" aria-hidden /> Próxima dose:{" "}
                  <strong>{hora(m.proximo_horario_previsto)}</strong>
                </p>
              </div>
              {m.atrasado && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-sm font-bold uppercase text-destructive-foreground">
                  <AlarmClock className="size-4" aria-hidden /> Atrasado
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="lg"
                className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                disabled={!cuidadorAtual}
                onClick={() => setSelecionado(m)}
              >
                <CheckCircle2 className="size-5" aria-hidden /> Confirmar dose
              </Button>
              <Button
                size="lg"
                variant="outline"
                aria-label={`Inativar ${m.nome}`}
                onClick={() => void remover(m)}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <ModalConfirmarDose
        medicamento={selecionado}
        aberto={!!selecionado}
        cuidador={cuidadorAtual?.nome ?? null}
        enviando={enviando}
        onFechar={() => setSelecionado(null)}
        onConfirmar={(obs) => void confirmar(obs)}
      />

      <ModalDoseJaConfirmada
        dose={duplicada?.dose ?? null}
        mensagem={duplicada?.mensagem ?? ""}
        onFechar={() => setDuplicada(null)}
      />
    </div>
  );
}

/* ---------- cadastro de medicamento ---------- */

function FormMedicamento({
  idosoId,
  medicamentos,
  aoSalvar,
}: {
  idosoId: number;
  medicamentos: Medicamento[];
  aoSalvar: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [principio, setPrincipio] = useState("");
  const [dosagem, setDosagem] = useState("");
  const [horario, setHorario] = useState("");
  const [frequencia, setFrequencia] = useState("24");
  const [registro, setRegistro] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [riscoAlto, setRiscoAlto] = useState<{ interacao: Interacao; mensagem: string } | null>(
    null,
  );
  const [aviso, setAviso] = useState<Interacao | null>(null);

  const duplicado = medicamentos.some(
    (m) =>
      m.principio_ativo.trim().toLowerCase() === principio.trim().toLowerCase() &&
      m.dosagem.trim().toLowerCase() === dosagem.trim().toLowerCase() &&
      principio.trim() !== "",
  );

  function montar(confirmar: boolean): NovoMedicamento {
    return {
      nome: nome.trim(),
      principio_ativo: principio.trim(),
      dosagem: dosagem.trim(),
      horario,
      frequencia_horas: Number(frequencia),
      ...(registro.trim() ? { registro_ms: registro.trim() } : {}),
      confirmar_risco_alto: confirmar,
    };
  }

  function limpar() {
    setNome("");
    setPrincipio("");
    setDosagem("");
    setHorario("");
    setFrequencia("24");
    setRegistro("");
  }

  async function enviar(confirmarRisco: boolean) {
    setEnviando(true);
    setErroForm(null);
    try {
      const resposta = await api.criarMedicamento(idosoId, montar(confirmarRisco));
      setRiscoAlto(null);
      setAviso(resposta.interacao ?? null);
      limpar();
      toast.success("Medicamento cadastrado.");
      await aoSalvar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.interacao) {
        setRiscoAlto({ interacao: e.interacao, mensagem: e.message });
      } else {
        setRiscoAlto(null);
        setErroForm(mensagemDeErro(e));
      }
    } finally {
      setEnviando(false);
    }
  }

  function validarEEnviar(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    setAviso(null);
    if (nome.trim().length < 2) return setErroForm("Informe o nome do remédio.");
    if (principio.trim().length < 3) return setErroForm("Informe o princípio ativo.");
    if (!dosagem.trim()) return setErroForm("Informe a dosagem (ex.: 50 mg).");
    if (!horaValida(horario))
      return setErroForm("Informe um horário válido no formato 24h (ex.: 08:00).");
    const f = Number(frequencia);
    if (!Number.isInteger(f) || f < 1 || f > 24)
      return setErroForm("A frequência deve ser um número de horas entre 1 e 24.");
    if (duplicado)
      return setErroForm(
        "Este idoso já usa um remédio ativo com o mesmo princípio ativo e a mesma dosagem.",
      );
    void enviar(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cadastrar medicamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={validarEEnviar} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="med-nome" className="text-base">
                Nome do remédio
              </Label>
              <Input
                id="med-nome"
                value={nome}
                maxLength={100}
                onChange={(e) => setNome(e.target.value)}
                className="h-12 text-base"
                placeholder="Ex.: Losartana Potássica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-pa" className="text-base">
                Princípio ativo
              </Label>
              <Input
                id="med-pa"
                value={principio}
                maxLength={100}
                onChange={(e) => setPrincipio(e.target.value)}
                className="h-12 text-base"
                placeholder="Ex.: Losartana"
              />
              {duplicado && (
                <p className="text-base font-medium text-destructive">
                  Já existe um remédio ativo com este princípio ativo e dosagem.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="med-dose" className="text-base">
                  Dosagem
                </Label>
                <Input
                  id="med-dose"
                  value={dosagem}
                  maxLength={40}
                  onChange={(e) => setDosagem(e.target.value)}
                  className="h-12 text-base"
                  placeholder="50 mg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-hora" className="text-base">
                  Horário
                </Label>
                <Input
                  id="med-hora"
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-freq" className="text-base">
                A cada quantas horas?
              </Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger id="med-freq" className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 12, 24].map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-base">
                      A cada {h} horas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-ms" className="text-base">
                Registro MS / ANVISA (opcional)
              </Label>
              <Input
                id="med-ms"
                value={registro}
                maxLength={30}
                onChange={(e) => setRegistro(e.target.value)}
                className="h-12 text-base"
                placeholder="1.0043.0123"
              />
            </div>

            {erroForm && <p className="text-base font-medium text-destructive">{erroForm}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={enviando || duplicado}>
              {enviando ? <Enviando /> : "Salvar medicamento"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {aviso && aviso.nivel_risco !== "alto" && (
        <Alert className="mt-4 border-warning bg-warning/10 text-base">
          <Info className="size-5" />
          <AlertTitle>Atenção: possível interação {aviso.nivel_risco}</AlertTitle>
          <AlertDescription>
            {aviso.principio_ativo_a} + {aviso.principio_ativo_b}. Vale comentar com o médico na
            próxima consulta.
          </AlertDescription>
        </Alert>
      )}

      <ModalRiscoAlto
        interacao={riscoAlto?.interacao ?? null}
        mensagem={riscoAlto?.mensagem ?? ""}
        enviando={enviando}
        onCancelar={() => setRiscoAlto(null)}
        onProsseguir={() => void enviar(true)}
      />
    </>
  );
}

/* ---------- cuidadores vinculados ---------- */

function AbaCuidadores({
  idoso,
  cuidadorAtual,
  aoAtualizar,
}: {
  idoso: Idoso;
  cuidadorAtual: Cuidador | null;
  aoAtualizar: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const vinculados = idoso.cuidadores ?? [];
  const souDono = vinculados.some((c) => c.id === cuidadorAtual?.id && c.eh_dono);

  async function convidar(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    if (!emailValido(email)) return setErroForm("Informe um email válido.");
    setEnviando(true);
    try {
      await api.criarConvite(idoso.id, email.trim());
      setEmail("");
      toast.success("Convite enviado.");
      await aoAtualizar();
    } catch (e) {
      setErroForm(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function desvincular(c: Cuidador) {
    setRemovendoId(c.id);
    try {
      await api.desvincularCuidador(idoso.id, c.id);
      toast.success(
        c.id === cuidadorAtual?.id ? "Você saiu deste idoso." : `${c.nome} foi removido.`,
      );
      await aoAtualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setRemovendoId(null);
    }
  }

  return (
    <div className="space-y-4">
      {vinculados.length === 0 ? (
        <Vazio
          titulo="Nenhum cuidador vinculado"
          descricao="Convide alguém pelo email para permitir a confirmação de doses."
        />
      ) : (
        <ul className="space-y-3">
          {vinculados.map((c) => {
            const souEu = c.id === cuidadorAtual?.id;
            const podeAgir = souEu || (souDono && !c.eh_dono);
            return (
              <li key={c.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-lg font-semibold">
                        {c.nome}
                        {c.eh_dono && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            (cadastrou este idoso)
                          </span>
                        )}
                      </p>
                      <p className="text-base text-muted-foreground">{c.telefone}</p>
                    </div>
                    {podeAgir && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={removendoId === c.id}
                        onClick={() => void desvincular(c)}
                      >
                        {souEu ? (
                          <>
                            <LogOut className="size-4" aria-hidden /> Sair
                          </>
                        ) : (
                          <>
                            <UserMinus className="size-4" aria-hidden /> Remover
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Convidar cuidador pelo email</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={convidar} className="space-y-3" noValidate>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              placeholder="email@exemplo.com"
              aria-label="Email do cuidador a convidar"
            />
            {erroForm && <p className="text-base font-medium text-destructive">{erroForm}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={enviando}>
              {enviando ? (
                <Enviando />
              ) : (
                <>
                  <UserPlus className="size-5" aria-hidden /> Enviar convite
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
