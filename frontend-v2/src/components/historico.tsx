import { Vazio } from "@/components/estados";
import { Card, CardContent } from "@/components/ui/card";
import { dataHora, hora } from "@/lib/formato";
import type { Dose, Medicamento } from "@/lib/tipos";

export function Historico({ doses, medicamentos }: { doses: Dose[]; medicamentos: Medicamento[] }) {
  if (doses.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma dose confirmada ainda"
        descricao="Assim que alguém confirmar uma dose, ela aparece aqui e não pode ser alterada."
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
        {doses.map((d) => (
          <li key={d.id}>
            <Card>
              <CardContent className="space-y-1 py-4">
                <p className="text-lg font-semibold">{nomeDe(d.medicamento_id)}</p>
                <p className="text-base">
                  Previsto para {hora(d.horario_previsto)} · confirmado em{" "}
                  {dataHora(d.confirmado_em)}
                </p>
                <p className="text-base text-muted-foreground">Por {d.cuidador.nome}</p>
                {d.observacao && <p className="text-base italic">“{d.observacao}”</p>}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
