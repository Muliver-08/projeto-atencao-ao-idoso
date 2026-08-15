import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Interacao {
  principio_ativo_a: string
  principio_ativo_b: string
  nivel_risco: string
}

interface ConfirmarInteracaoDialogProps {
  open: boolean
  interacao: Interacao | null
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmarInteracaoDialog({
  open,
  interacao,
  onConfirmar,
  onCancelar,
}: ConfirmarInteracaoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Interação de risco alto identificada</DialogTitle>
          <DialogDescription>
            {interacao &&
              `Há interação de risco alto entre "${interacao.principio_ativo_a}" e "${interacao.principio_ativo_b}". Confirme apenas se estiver ciente do risco.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirmar}>
            Entendo o risco e quero prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
