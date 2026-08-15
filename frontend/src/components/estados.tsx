import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Carregando informações...</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function AvisoErro({ mensagem, acao }: { mensagem: string; acao?: ReactNode }) {
  return (
    <Alert variant="destructive" className="text-base">
      <AlertTriangle className="size-5" />
      <AlertTitle>Algo não funcionou</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{mensagem}</p>
        {acao}
      </AlertDescription>
    </Alert>
  );
}

export function Vazio({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
      <p className="text-lg font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 text-muted-foreground">{descricao}</p>
    </div>
  );
}

export function Enviando({ texto = "Salvando..." }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto}
    </span>
  );
}
