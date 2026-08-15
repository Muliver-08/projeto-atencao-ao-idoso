import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router"
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

function extrairMensagemErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro) && erro.response?.data?.detail) {
    return String(erro.response.data.detail)
  }
  return padrao
}

function formatarData(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

function paraDataISO(valorMascarado: string): string | null {
  const digitos = valorMascarado.replace(/\D/g, "")
  if (digitos.length !== 8) return null

  const dia = Number(digitos.slice(0, 2))
  const mes = Number(digitos.slice(2, 4))
  const ano = Number(digitos.slice(4, 8))

  const data = new Date(ano, mes - 1, dia)
  const dataValida =
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia

  if (!dataValida) return null

  const dd = String(dia).padStart(2, "0")
  const mm = String(mes).padStart(2, "0")
  return `${ano}-${mm}-${dd}`
}

export default function Idosos() {
  const [idosos, setIdosos] = useState<Idoso[]>([])
  const [nome, setNome] = useState("")
  const [dataNascimento, setDataNascimento] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function carregarIdosos() {
    try {
      const resposta = await api.get<Idoso[]>("/idosos")
      setIdosos(resposta.data)
      setErroLista(null)
    } catch {
      setErroLista(
        "Não foi possível carregar os idosos. Tente novamente mais tarde."
      )
    }
  }

  useEffect(() => {
    carregarIdosos()
  }, [])

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroForm(null)

    const dataISO = paraDataISO(dataNascimento)
    if (!nome.trim() || !dataISO) {
      setErroForm("Preencha nome e uma data de nascimento válida (DD/MM/AAAA).")
      return
    }
    if (new Date(dataISO) > new Date()) {
      setErroForm("Data de nascimento não pode ser no futuro.")
      return
    }

    setEnviando(true)
    try {
      await api.post("/idosos", {
        nome: nome.trim(),
        data_nascimento: dataISO,
        observacoes: observacoes.trim() || null,
      })
      setNome("")
      setDataNascimento("")
      setObservacoes("")
      await carregarIdosos()
    } catch (erro) {
      setErroForm(extrairMensagemErro(erro, "Não foi possível cadastrar o idoso."))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar idoso</CardTitle>
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
              <label htmlFor="data_nascimento" className="text-base font-medium">
                Data de nascimento
              </label>
              <Input
                id="data_nascimento"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(formatarData(e.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="observacoes" className="text-base font-medium">
                Observações
              </label>
              <Input
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
            {erroForm && (
              <Alert variant="destructive">
                <AlertDescription>{erroForm}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Cadastrando..." : "Cadastrar idoso"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Idosos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {erroLista && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{erroLista}</AlertDescription>
            </Alert>
          )}
          {!erroLista && idosos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum idoso cadastrado ainda.
            </p>
          )}
          {idosos.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Idade</TableHead>
                  <TableHead>Cuidadores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {idosos.map((idoso) => (
                  <TableRow key={idoso.id}>
                    <TableCell>
                      <Link
                        to={`/idosos/${idoso.id}`}
                        className="underline underline-offset-2"
                      >
                        {idoso.nome}
                      </Link>
                    </TableCell>
                    <TableCell>{idoso.idade}</TableCell>
                    <TableCell>
                      {idoso.cuidadores.length > 0
                        ? idoso.cuidadores.map((c) => c.nome).join(", ")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
