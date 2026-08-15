import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Enviando } from "@/components/estados";
import { dataHora, hora } from "@/lib/formato";
import type { Dose, Interacao, Medicamento } from "@/lib/tipos";

export function ModalConfirmarDose({
  medicamento,
  aberto,
  cuidador,
  enviando,
  onFechar,
  onConfirmar,
}: {
  medicamento: Medicamento | null;
  aberto: boolean;
  cuidador: string | null;
  enviando: boolean;
  onFechar: () => void;
  onConfirmar: (observacao: string) => void;
}) {
  const [observacao, setObservacao] = useState("");

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          setObservacao("");
          onFechar();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Confirmar dose</DialogTitle>
          <DialogDescription className="text-base">
            {medicamento
              ? `${medicamento.nome} ${medicamento.dosagem} — horário previsto ${hora(medicamento.proximo_horario_previsto)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Será registrado em nome de <strong>{cuidador ?? "ninguém selecionado"}</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="obs" className="text-base">
              Observação (opcional)
            </Label>
            <Textarea
              id="obs"
              value={observacao}
              maxLength={300}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: tomou com água, ficou enjoada..."
              className="min-h-24 text-base"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="lg" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            size="lg"
            className="bg-success text-success-foreground hover:bg-success/90"
            disabled={enviando || !cuidador}
            onClick={() => onConfirmar(observacao)}
          >
            {enviando ? (
              <Enviando texto="Confirmando..." />
            ) : (
              <>
                <CheckCircle2 className="size-5" aria-hidden /> Confirmar dose
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModalDoseJaConfirmada({
  dose,
  mensagem,
  onFechar,
}: {
  dose: Dose | null;
  mensagem: string;
  onFechar: () => void;
}) {
  return (
    <Dialog open={!!dose || !!mensagem} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md border-warning">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="size-6 text-warning" aria-hidden />
            Esta dose já foi confirmada
          </DialogTitle>
          <DialogDescription className="text-base">
            Para evitar dose duplicada, o registro não pode ser feito de novo.
          </DialogDescription>
        </DialogHeader>

        {dose ? (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-4 text-base">
            <p>
              Confirmada por <strong>{dose.cuidador.nome}</strong>
            </p>
            <p>em {dataHora(dose.confirmado_em)}</p>
            {dose.observacao && <p className="text-muted-foreground">“{dose.observacao}”</p>}
          </div>
        ) : (
          <p className="text-base">{mensagem}</p>
        )}

        <DialogFooter>
          <Button size="lg" className="w-full" onClick={onFechar}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModalRiscoAlto({
  interacao,
  mensagem,
  enviando,
  onCancelar,
  onProsseguir,
}: {
  interacao: Interacao | null;
  mensagem: string;
  enviando: boolean;
  onCancelar: () => void;
  onProsseguir: () => void;
}) {
  return (
    <Dialog open={!!interacao} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="max-w-md border-destructive">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-destructive">
            <ShieldAlert className="size-6" aria-hidden />
            Risco alto de interação
          </DialogTitle>
          <DialogDescription className="text-base">
            {mensagem ||
              "Este medicamento pode interagir de forma perigosa com outro que o idoso já usa."}
          </DialogDescription>
        </DialogHeader>

        {interacao && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-base">
            <p className="font-semibold">
              {interacao.principio_ativo_a} + {interacao.principio_ativo_b}
            </p>
            <p className="mt-1 uppercase tracking-wide text-destructive">
              Nível de risco: {interacao.nivel_risco}
            </p>
            <p className="mt-2 text-muted-foreground">
              Converse com o médico responsável antes de continuar.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={enviando}
            onClick={onProsseguir}
          >
            {enviando ? <Enviando /> : "Entendo o risco e quero prosseguir"}
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={onCancelar}>
            Cancelar cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
