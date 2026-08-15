import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, mensagemDeErro } from "./api";
import type { Cuidador } from "./tipos";

interface CtxCuidador {
  cuidadores: Cuidador[];
  cuidadorAtual: Cuidador | null;
  carregando: boolean;
  erro: string | null;
  escolher: (id: number) => Promise<void>;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<CtxCuidador | null>(null);

export function CuidadorProvider({ children }: { children: ReactNode }) {
  const [cuidadores, setCuidadores] = useState<Cuidador[]>([]);
  const [cuidadorAtual, setCuidadorAtual] = useState<Cuidador | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await api.listarCuidadores();
      setCuidadores(lista);
      const sessao = await api.obterSessao();
      const atual = lista.find((c) => c.id === sessao.cuidador_id) ?? null;
      setCuidadorAtual(atual);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const escolher = useCallback(
    async (id: number) => {
      setErro(null);
      try {
        await api.definirSessao(id);
        const lista = cuidadores.length ? cuidadores : await api.listarCuidadores();
        setCuidadores(lista);
        setCuidadorAtual(lista.find((c) => c.id === id) ?? null);
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    },
    [cuidadores],
  );

  return (
    <Ctx.Provider value={{ cuidadores, cuidadorAtual, carregando, erro, escolher, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCuidador() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCuidador precisa estar dentro de CuidadorProvider");
  return ctx;
}
