import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AvisoErro, Carregando, Vazio } from "@/components/estados";
import { Historico } from "@/components/historico";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, mensagemDeErro } from "@/lib/api";
import type { Dose, Idoso, Medicamento } from "@/lib/tipos";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de doses — Diário de Medicação" },
      {
        name: "description",
        content:
          "Consulte o registro imutável de todas as doses confirmadas, com horário, cuidador responsável e observações.",
      },
      { property: "og:title", content: "Histórico de doses — Diário de Medicação" },
      {
        property: "og:description",
        content:
          "Registro somente leitura das doses confirmadas, pronto para levar à consulta médica.",
      },
    ],
  }),
  component: PaginaHistorico,
});

function PaginaHistorico() {
  const [idosos, setIdosos] = useState<Idoso[]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarIdosos() {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await api.listarIdosos();
      setIdosos(lista);
      if (!selecionado && lista[0]) setSelecionado(String(lista[0].id));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarIdosos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const [d, m] = await Promise.all([
          api.listarDoses(Number(selecionado)),
          api.listarMedicamentos(Number(selecionado)),
        ]);
        if (cancelado) return;
        setDoses(d);
        setMedicamentos(m);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [selecionado]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Histórico de doses</h1>

      <div className="space-y-2">
        <Label htmlFor="h-idoso" className="text-base">
          Ver histórico de
        </Label>
        <Select value={selecionado} onValueChange={setSelecionado}>
          <SelectTrigger id="h-idoso" className="h-12 text-base">
            <SelectValue placeholder="Escolher idoso" />
          </SelectTrigger>
          <SelectContent>
            {idosos.map((i) => (
              <SelectItem key={i.id} value={String(i.id)} className="text-base">
                {i.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {erro && (
        <AvisoErro
          mensagem={erro}
          acao={
            <Button variant="outline" onClick={() => void carregarIdosos()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {carregando ? (
        <Carregando />
      ) : idosos.length === 0 ? (
        <Vazio
          titulo="Nenhum idoso cadastrado"
          descricao="Cadastre um idoso para começar o histórico."
        />
      ) : (
        <Historico doses={doses} medicamentos={medicamentos} />
      )}
    </div>
  );
}
