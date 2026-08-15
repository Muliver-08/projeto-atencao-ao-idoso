import { useEffect, useState, type FormEvent } from "react"
import axios from "axios"

import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const TELEFONE_PATTERN = /^\(\d{2}\) \d{4,5}-\d{4}$/

interface Cuidador {
  id: number
  nome: string
  telefone: string
}

interface Idoso {
  id: number
  nome: string
}

function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11)
  if (digitos.length === 0) return ""

  const ddd = digitos.slice(0, 2)
  if (digitos.length <= 2) return `(${ddd}`

  const numero = digitos.slice(2)
  const tamanhoPrefixo = digitos.length > 10 ? 5 : 4
  const prefixo = numero.slice(0, tamanhoPrefixo)
  const sufixo = numero.slice(tamanhoPrefixo)

  return sufixo ? `(${ddd}) ${prefixo}-${sufixo}` : `(${ddd}) ${prefixo}`
}

function extrairMensagemErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro) && erro.response?.data?.detail) {
    return String(erro.response.data.detail)
  }
  return padrao
}

export default function Cuidadores() {
  const [cuidadores, setCuidadores] = useState<Cuidador[]>([])
  const [idosos, setIdosos] = useState<Idoso[]>([])
  const [nome, setNome] = useState("")
  const [telefone, setTelefone] = useState("")
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [idosoSelecionado, setIdosoSelecionado] = useState<number | null>(null)
  const [cuidadorSelecionado, setCuidadorSelecionado] = useState<number | null>(
    null
  )
  const [erroVinculo, setErroVinculo] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)

  async function carregarDados() {
    try {
      const [cuidadoresResp, idososResp] = await Promise.all([
        api.get<Cuidador[]>("/cuidadores"),
        api.get<Idoso[]>("/idosos"),
      ])
      setCuidadores(cuidadoresResp.data)
      setIdosos(idososResp.data)
      setErroLista(null)
    } catch {
      setErroLista(
        "Não foi possível carregar os dados. Tente novamente mais tarde."
      )
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroForm(null)

    if (!nome.trim() || !TELEFONE_PATTERN.test(telefone)) {
      setErroForm("Preencha o nome e um telefone no formato (xx) xxxxx-xxxx.")
      return
    }

    setEnviando(true)
    try {
      await api.post("/cuidadores", { nome: nome.trim(), telefone })
      setNome("")
      setTelefone("")
      await carregarDados()
    } catch (erro) {
      setErroForm(
        extrairMensagemErro(erro, "Não foi possível cadastrar o cuidador.")
      )
    } finally {
      setEnviando(false)
    }
  }

  async function handleVincular() {
    setErroVinculo(null)
    if (idosoSelecionado === null || cuidadorSelecionado === null) {
      setErroVinculo("Selecione um idoso e um cuidador.")
      return
    }

    setVinculando(true)
    try {
      await api.post(
        `/idosos/${idosoSelecionado}/cuidadores/${cuidadorSelecionado}`
      )
      await carregarDados()
    } catch (erro) {
      setErroVinculo(
        extrairMensagemErro(erro, "Não foi possível vincular o cuidador.")
      )
    } finally {
      setVinculando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar cuidador</CardTitle>
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
              <label htmlFor="telefone" className="text-base font-medium">
                Telefone
              </label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(51) 99999-9999"
                inputMode="numeric"
                maxLength={15}
                required
              />
            </div>
            {erroForm && (
              <Alert variant="destructive">
                <AlertDescription>{erroForm}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Cadastrando..." : "Cadastrar cuidador"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vincular cuidador a idoso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Select value={idosoSelecionado} onValueChange={setIdosoSelecionado}>
              <SelectTrigger aria-label="Idoso">
                <SelectValue placeholder="Selecionar idoso" />
              </SelectTrigger>
              <SelectContent>
                {idosos.map((idoso) => (
                  <SelectItem key={idoso.id} value={idoso.id}>
                    {idoso.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cuidadorSelecionado}
              onValueChange={setCuidadorSelecionado}
            >
              <SelectTrigger aria-label="Cuidador">
                <SelectValue placeholder="Selecionar cuidador" />
              </SelectTrigger>
              <SelectContent>
                {cuidadores.map((cuidador) => (
                  <SelectItem key={cuidador.id} value={cuidador.id}>
                    {cuidador.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleVincular} disabled={vinculando}>
              {vinculando ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
          {erroVinculo && (
            <Alert variant="destructive">
              <AlertDescription>{erroVinculo}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuidadores cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {erroLista && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{erroLista}</AlertDescription>
            </Alert>
          )}
          {!erroLista && cuidadores.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum cuidador cadastrado ainda.
            </p>
          )}
          {cuidadores.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuidadores.map((cuidador) => (
                  <TableRow key={cuidador.id}>
                    <TableCell>{cuidador.nome}</TableCell>
                    <TableCell>{cuidador.telefone}</TableCell>
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
