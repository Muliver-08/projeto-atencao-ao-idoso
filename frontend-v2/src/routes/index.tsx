import { createFileRoute, Link } from "@tanstack/react-router";
import { AlarmClock, ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AvisoErro, Carregando, Vazio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, mensagemDeErro } from "@/lib/api";
import { useCuidador } from "@/lib/cuidador-contexto";
import type { Idoso, Medicamento } from "@/lib/tipos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Diário de Medicação" },
      {
        name: "description",
        content:
          "Acompanhe em um só lugar quem precisa tomar remédio agora, quais doses estão atrasadas e quem confirmou cada dose.",
      },
      { property: "og:title", content: "Início — Diário de Medicação" },
      {
        property: "og:description",
        content:
          "Doses sem duplicidade, alertas de interação e histórico confiável entre cuidadores.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { cuidadorAtual } = useCuidador();
  const [idosos, setIdosos] = useState<Idoso[]>([]);
  const [atrasados, setAtrasados] = useState<Record<number, Medicamento[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await api.listarIdosos();
      setIdosos(lista);
      const pares = await Promise.all(
        lista.map(
          async (i) =>
            [i.id, (await api.listarMedicamentos(i.id)).filter((m) => m.atrasado)] as const,
        ),
      );
      setAtrasados(Object.fromEntries(pares));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const totalAtrasos = Object.values(atrasados).reduce((s, v) => s + v.length, 0);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá{cuidadorAtual ? `, ${cuidadorAtual.nome.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Confirme doses sem risco de repetir o que outro cuidador já fez.
        </p>
      </section>

      {!cuidadorAtual && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="py-4 text-base">
            Escolha no topo da tela <strong>quem está usando o app</strong>. Toda dose confirmada
            fica registrada em nome dessa pessoa.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <Users className="size-5" aria-hidden /> Idosos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {carregando ? "—" : idosos.length}
          </CardContent>
        </Card>
        <Card className={totalAtrasos > 0 ? "border-destructive" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <AlarmClock className="size-5" aria-hidden /> Doses atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-3xl font-bold ${totalAtrasos > 0 ? "text-destructive" : "text-success"}`}
          >
            {carregando ? "—" : totalAtrasos}
          </CardContent>
        </Card>
      </div>

      {erro && (
        <AvisoErro
          mensagem={erro}
          acao={
            <Button variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {carregando ? (
        <Carregando linhas={2} />
      ) : idosos.length === 0 ? (
        <Vazio
          titulo="Nenhum idoso cadastrado"
          descricao="Cadastre a pessoa que será acompanhada para começar a registrar os remédios."
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Quem você acompanha</h2>
          {idosos.map((i) => {
            const lista = atrasados[i.id] ?? [];
            return (
              <Link key={i.id} to="/idosos/$id" params={{ id: String(i.id) }} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-lg font-semibold">{i.nome}</p>
                      <p className="text-sm text-muted-foreground">{i.idade} anos</p>
                      {lista.length > 0 ? (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 text-sm font-semibold text-destructive-foreground">
                          <AlarmClock className="size-4" aria-hidden /> {lista.length} dose(s)
                          atrasada(s)
                        </p>
                      ) : (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-success">
                          <ShieldCheck className="size-4" aria-hidden /> Tudo em dia
                        </p>
                      )}
                    </div>
                    <ArrowRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
