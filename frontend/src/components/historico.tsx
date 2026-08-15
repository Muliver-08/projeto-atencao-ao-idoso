import { LogOut, UserMinus } from "lucide-react";
import { Vazio } from "@/components/estados";
import { Card, CardContent } from "@/components/ui/card";
import { dataHora, hora } from "@/lib/formato";
import type { Dose, EventoVinculo, Medicamento } from "@/lib/tipos";

type ItemHistorico =
  | { tipo: "dose"; data: string; dose: Dose }
  | { tipo: "vinculo"; data: string; evento: EventoVinculo };

export function Historico({
  doses,
  medicamentos,
  eventosVinculo = [],
}: {
  doses: Dose[];
  medicamentos: Medicamento[];
  eventosVinculo?: EventoVinculo[];
}) {
  const itens: ItemHistorico[] = [
    ...doses.map((dose): ItemHistorico => ({ tipo: "dose", data: dose.confirmado_em, dose })),
    ...eventosVinculo.map((evento): ItemHistorico => ({
      tipo: "vinculo",
      data: evento.criado_em,
      evento,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  if (itens.length === 0) {
    return (
      <Vazio
        titulo="Nenhum evento ainda"
        descricao="Assim que alguém confirmar uma dose ou sair/entrar como cuidador, aparece aqui e não pode ser alterado."
      />
    );
  }

  const nomeDe = (id: number) =>
    medicamentos.find((m) => m.id === id)?.nome ?? "Medicamento inativado";

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Registro permanente: o histórico não pode ser editado nem apagado.
      </p>
      <ul className="space-y-3">
        {itens.map((item) =>
          item.tipo === "dose" ? (
            <li key={`dose-${item.dose.id}`}>
              <Card>
                <CardContent className="space-y-1 py-4">
                  <p className="text-lg font-semibold">{nomeDe(item.dose.medicamento_id)}</p>
                  <p className="text-base">
                    Previsto para {hora(item.dose.horario_previsto)} · confirmado em{" "}
                    {dataHora(item.dose.confirmado_em)}
                  </p>
                  <p className="text-base text-muted-foreground">Por {item.dose.cuidador.nome}</p>
                  {item.dose.observacao && (
                    <p className="text-base italic">“{item.dose.observacao}”</p>
                  )}
                </CardContent>
              </Card>
            </li>
          ) : (
            <li key={`vinculo-${item.evento.id}`}>
              <Card>
                <CardContent className="space-y-1 py-4">
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    {item.evento.tipo_evento === "saiu" ? (
                      <LogOut className="size-5 text-muted-foreground" aria-hidden />
                    ) : (
                      <UserMinus className="size-5 text-muted-foreground" aria-hidden />
                    )}
                    {item.evento.cuidador.nome}{" "}
                    {item.evento.tipo_evento === "saiu"
                      ? "saiu do diário"
                      : "foi removido do diário"}
                  </p>
                  <p className="text-base text-muted-foreground">
                    {dataHora(item.evento.criado_em)}
                    {item.evento.realizado_por &&
                      ` · removido por ${item.evento.realizado_por.nome}`}
                  </p>
                </CardContent>
              </Card>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
