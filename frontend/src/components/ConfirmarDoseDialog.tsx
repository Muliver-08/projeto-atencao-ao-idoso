import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmarDoseDialogProps {
  open: boolean
  medicamentoNome: string
  enviando: boolean
  onConfirmar: (observacao: string | null) => void
  onCancelar: () => void
}

export function ConfirmarDoseDialog({
  open,
  medicamentoNome,
  enviando,
  onConfirmar,
  onCancelar,
}: ConfirmarDoseDialogProps) {
  const [observacao, setObservacao] = useState("")

  function handleConfirmar() {
    onConfirmar(observacao.trim() || null)
    setObservacao("")
  }

  function handleCancelar() {
    setObservacao("")
    onCancelar()
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && handleCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar dose de {medicamentoNome}</DialogTitle>
          <DialogDescription>
            Confirme apenas se a dose foi realmente administrada agora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <label htmlFor="observacao" className="text-base font-medium">
            Observação (opcional)
          </label>
          <Input
            id="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={enviando}>
            {enviando ? "Confirmando..." : "Confirmar dose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
