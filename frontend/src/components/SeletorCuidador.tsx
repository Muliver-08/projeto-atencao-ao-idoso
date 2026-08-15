import { useEffect, useState } from "react"

import api from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Cuidador {
  id: number
  nome: string
  telefone: string
}

export function SeletorCuidador() {
  const [cuidadores, setCuidadores] = useState<Cuidador[]>([])
  const [cuidadorId, setCuidadorId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      try {
        const [cuidadoresResp, sessaoResp] = await Promise.all([
          api.get<Cuidador[]>("/cuidadores"),
          api.get<{ cuidador_id: number | null }>("/sessao"),
        ])
        setCuidadores(cuidadoresResp.data)
        setCuidadorId(sessaoResp.data.cuidador_id)
      } catch {
        setErro("Não foi possível carregar os cuidadores.")
      }
    }
    carregar()
  }, [])

  async function selecionar(valor: number | null) {
    if (valor === null) return
    setCuidadorId(valor)
    try {
      await api.post("/sessao", { cuidador_id: valor })
      setErro(null)
    } catch {
      setErro("Não foi possível selecionar o cuidador.")
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select value={cuidadorId} onValueChange={selecionar}>
        <SelectTrigger
          aria-label="Cuidador atual"
          className="border-white/40 bg-white/10 text-primary-foreground data-placeholder:text-primary-foreground/70 [&_svg]:text-primary-foreground/80"
        >
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
      {erro && (
        <span className="text-sm font-medium text-white">{erro}</span>
      )}
    </div>
  )
}
