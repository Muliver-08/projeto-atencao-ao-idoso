import { useEffect, useState, type FormEvent } from "react"
import { useParams } from "react-router"
import axios from "axios"

import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmarInteracaoDialog } from "@/components/ConfirmarInteracaoDialog"
import { ConfirmarDoseDialog } from "@/components/ConfirmarDoseDialog"

interface Cuidador {
  id: number
  nome: string
  telefone: string
}

interface Idoso {
  id: number
  nome: string
  data_nascimento: string
  idade: number
  observacoes: string | null
  cuidadores: Cuidador[]
}

interface Interacao {
  principio_ativo_a: string
  principio_ativo_b: string
  nivel_risco: string
}

interface Medicamento {
  id: number
  idoso_id: number
  nome: string
  principio_ativo: string
  dosagem: string
  horario: string
  frequencia_horas: number
  registro_ms: string | null
  ativo: boolean
  proximo_horario_previsto: string
  atrasado: boolean
}

interface RegistroDose {
  id: number
  medicamento_id: number
  horario_previsto: string
  confirmado_em: string
  observacao: string | null
  cuidador: Cuidador
}

function formatarDataHora(valor: string): string {
  return new Date(valor).toLocaleString("pt-BR")
}

function formatarHorario(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 4)
  if (digitos.length <= 2) return digitos
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`
}

function horarioValido(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
}

function extrairMensagemErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    const detail = erro.response?.data?.detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object" && "mensagem" in detail) {
      return String(detail.mensagem)
    }
  }
  return padrao
}

export default function IdosoDetalhe() {
  const { id } = useParams<{ id: string }>()

  const [idoso, setIdoso] = useState<Idoso | null>(null)
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [doses, setDoses] = useState<RegistroDose[]>([])
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [medicamentoParaDose, setMedicamentoParaDose] = useState<Medicamento | null>(
    null
  )
  const [enviandoDose, setEnviandoDose] = useState(false)
  const [erroDose, setErroDose] = useState<string | null>(null)

  const [nome, setNome] = useState("")
  const [principioAtivo, setPrincipioAtivo] = useState("")
  const [dosagem, setDosagem] = useState("")
  const [horario, setHorario] = useState("")
  const [frequenciaHoras, setFrequenciaHoras] = useState("")
  const [registroMs, setRegistroMs] = useState("")
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [avisoInteracao, setAvisoInteracao] = useState<Interacao | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [dialogInteracao, setDialogInteracao] = useState<Interacao | null>(null)

  async function carregarDados() {
    if (!id) return
    try {
      const [idosoResp, medicamentosResp, dosesResp] = await Promise.all([
        api.get<Idoso>(`/idosos/${id}`),
        api.get<Medicamento[]>(`/idosos/${id}/medicamentos`),
        api.get<RegistroDose[]>(`/idosos/${id}/doses`),
      ])
      setIdoso(idosoResp.data)
      setMedicamentos(medicamentosResp.data)
      setDoses(dosesResp.data)
      setErroLista(null)
    } catch {
      setErroLista(
        "Não foi possível carregar os dados do idoso. Tente novamente mais tarde."
      )
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function limparForm() {
    setNome("")
    setPrincipioAtivo("")
    setDosagem("")
    setHorario("")
    setFrequenciaHoras("")
    setRegistroMs("")
  }

  async function enviarMedicamento(confirmarRiscoAlto: boolean) {
    if (!id) return
    setEnviando(true)
    try {
      const resposta = await api.post(`/idosos/${id}/medicamentos`, {
        nome: nome.trim(),
        principio_ativo: principioAtivo.trim(),
        dosagem: dosagem.trim(),
        horario: `${horario}:00`,
        frequencia_horas: Number(frequenciaHoras),
        registro_ms: registroMs.trim() || null,
        confirmar_risco_alto: confirmarRiscoAlto,
      })
      setAvisoInteracao(resposta.data.interacao ?? null)
      setDialogInteracao(null)
      limparForm()
      await carregarDados()
    } catch (erro) {
      if (axios.isAxiosError(erro) && erro.response?.status === 409) {
        setDialogInteracao(erro.response.data.detail.interacao)
        return
      }
      setErroForm(
        extrairMensagemErro(erro, "Não foi possível cadastrar o medicamento.")
      )
    } finally {
      setEnviando(false)
    }
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroForm(null)
    setAvisoInteracao(null)

    if (
      !nome.trim() ||
      !principioAtivo.trim() ||
      !dosagem.trim() ||
      !horarioValido(horario) ||
      !frequenciaHoras ||
      Number(frequenciaHoras) <= 0
    ) {
      setErroForm(
        "Preencha nome, princípio ativo, dosagem, horário (HH:MM) e frequência válidos."
      )
      return
    }

    await enviarMedicamento(false)
  }

  async function handleRemover(medicamentoId: number) {
    try {
      await api.delete(`/medicamentos/${medicamentoId}`)
      await carregarDados()
    } catch (erro) {
      setErroLista(
        extrairMensagemErro(erro, "Não foi possível remover o medicamento.")
      )
    }
  }

  async function confirmarDose(observacao: string | null) {
    if (!medicamentoParaDose) return
    setEnviandoDose(true)
    setErroDose(null)
    try {
      await api.post(`/medicamentos/${medicamentoParaDose.id}/doses`, {
        observacao,
      })
      setMedicamentoParaDose(null)
      await carregarDados()
    } catch (erro) {
      setErroDose(
        extrairMensagemErro(erro, "Não foi possível confirmar a dose.")
      )
    } finally {
      setEnviandoDose(false)
    }
  }

  if (erroLista && !idoso) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erroLista}</AlertDescription>
      </Alert>
    )
  }

  if (!idoso) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{idoso.nome}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>Idade: {idoso.idade}</p>
          {idoso.observacoes && <p>Observações: {idoso.observacoes}</p>}
          <p>
            Cuidadores:{" "}
            {idoso.cuidadores.length > 0
              ? idoso.cuidadores.map((c) => c.nome).join(", ")
              : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadastrar medicamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="nome" className="text-base font-medium">
                Nome
              </label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="principio_ativo" className="text-base font-medium">
                Princípio ativo
              </label>
              <Input
                id="principio_ativo"
                value={principioAtivo}
                onChange={(e) => setPrincipioAtivo(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dosagem" className="text-base font-medium">
                Dosagem
              </label>
              <Input
                id="dosagem"
                value={dosagem}
                onChange={(e) => setDosagem(e.target.value)}
                placeholder="500mg"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="horario" className="text-base font-medium">
                Horário
              </label>
              <Input
                id="horario"
                value={horario}
                onChange={(e) => setHorario(formatarHorario(e.target.value))}
                placeholder="HH:MM"
                inputMode="numeric"
                maxLength={5}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="frequencia_horas" className="text-base font-medium">
                Frequência (horas)
              </label>
              <Input
                id="frequencia_horas"
                value={frequenciaHoras}
                onChange={(e) =>
                  setFrequenciaHoras(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                inputMode="numeric"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="registro_ms" className="text-base font-medium">
                Registro MS (opcional)
              </label>
              <Input
                id="registro_ms"
                value={registroMs}
                onChange={(e) => setRegistroMs(e.target.value)}
              />
            </div>
            {erroForm && (
              <Alert variant="destructive">
                <AlertDescription>{erroForm}</AlertDescription>
              </Alert>
            )}
            {avisoInteracao && (
              <Alert>
                <AlertDescription>
                  Interação de risco {avisoInteracao.nivel_risco} identificada entre
                  "{avisoInteracao.principio_ativo_a}" e "
                  {avisoInteracao.principio_ativo_b}".
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Cadastrando..." : "Cadastrar medicamento"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medicamentos ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {erroLista && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{erroLista}</AlertDescription>
            </Alert>
          )}
          {erroDose && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{erroDose}</AlertDescription>
            </Alert>
          )}
          {medicamentos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum medicamento cadastrado ainda.
            </p>
          )}
          {medicamentos.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Princípio ativo</TableHead>
                  <TableHead>Dosagem</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Próxima dose</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicamentos.map((medicamento) => (
                  <TableRow key={medicamento.id}>
                    <TableCell>{medicamento.nome}</TableCell>
                    <TableCell>{medicamento.principio_ativo}</TableCell>
                    <TableCell>{medicamento.dosagem}</TableCell>
                    <TableCell>{medicamento.horario.slice(0, 5)}</TableCell>
                    <TableCell>{medicamento.frequencia_horas}h</TableCell>
                    <TableCell>
                      {formatarDataHora(medicamento.proximo_horario_previsto)}
                      {medicamento.atrasado && (
                        <span className="ml-2 text-destructive font-medium">
                          Atrasado
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setErroDose(null)
                          setMedicamentoParaDose(medicamento)
                        }}
                      >
                        Confirmar dose
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemover(medicamento.id)}
                      >
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de doses</CardTitle>
        </CardHeader>
        <CardContent>
          {doses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma dose confirmada ainda.
            </p>
          )}
          {doses.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Cuidador</TableHead>
                  <TableHead>Horário previsto</TableHead>
                  <TableHead>Confirmado em</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doses.map((dose) => (
                  <TableRow key={dose.id}>
                    <TableCell>
                      {medicamentos.find((m) => m.id === dose.medicamento_id)?.nome ??
                        "—"}
                    </TableCell>
                    <TableCell>{dose.cuidador.nome}</TableCell>
                    <TableCell>{formatarDataHora(dose.horario_previsto)}</TableCell>
                    <TableCell>{formatarDataHora(dose.confirmado_em)}</TableCell>
                    <TableCell>{dose.observacao ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmarInteracaoDialog
        open={dialogInteracao !== null}
        interacao={dialogInteracao}
        onConfirmar={() => enviarMedicamento(true)}
        onCancelar={() => setDialogInteracao(null)}
      />

      <ConfirmarDoseDialog
        open={medicamentoParaDose !== null}
        medicamentoNome={medicamentoParaDose?.nome ?? ""}
        enviando={enviandoDose}
        onConfirmar={confirmarDose}
        onCancelar={() => setMedicamentoParaDose(null)}
      />
    </div>
  )
}
