import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AvisoErro, Carregando, Vazio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, mensagemDeErro } from "@/lib/api";
import { dataHora } from "@/lib/formato";
import type { Convite } from "@/lib/tipos";

export const Route = createFileRoute("/convites")({
  head: () => ({
    meta: [
      { title: "Convites — Diário de Medicação" },
      {
        name: "description",
        content: "Aceite ou recuse convites para acompanhar um idoso junto com outros cuidadores.",
      },
    ],
  }),
  component: PaginaConvites,
});

function PaginaConvites() {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<number | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setConvites(await api.listarConvites());
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function aceitar(c: Convite) {
    setRespondendo(c.id);
    try {
      await api.aceitarConvite(c.id);
      setConvites((atual) => atual.filter((x) => x.id !== c.id));
      toast.success("Convite aceito.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setRespondendo(null);
    }
  }

  async function recusar(c: Convite) {
    setRespondendo(c.id);
    try {
      await api.recusarConvite(c.id);
      setConvites((atual) => atual.filter((x) => x.id !== c.id));
      toast.success("Convite recusado.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setRespondendo(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Convites</h1>

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
      ) : convites.length === 0 ? (
        <Vazio
          titulo="Nenhum convite pendente"
          descricao="Quando outro cuidador te convidar para acompanhar um idoso, o convite aparece aqui."
        />
      ) : (
        <ul className="space-y-3">
          {convites.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <p className="text-base">
                    <strong className="font-semibold">{c.solicitado_por.nome}</strong> te convidou
                    para acompanhar um idoso.
                  </p>
                  <p className="text-sm text-muted-foreground">{dataHora(c.criado_em)}</p>
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                      disabled={respondendo === c.id}
                      onClick={() => void aceitar(c)}
                    >
                      <Check className="size-5" aria-hidden /> Aceitar
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={respondendo === c.id}
                      onClick={() => void recusar(c)}
                    >
                      <X className="size-5" aria-hidden /> Recusar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
