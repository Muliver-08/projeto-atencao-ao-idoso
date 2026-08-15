import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, mensagemDeErro } from "./api";
import type { Cuidador } from "./tipos";

interface CtxCuidador {
  cuidadorAtual: Cuidador | null;
  carregando: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<CtxCuidador | null>(null);

export function CuidadorProvider({ children }: { children: ReactNode }) {
  const [cuidadorAtual, setCuidadorAtual] = useState<Cuidador | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const sessao = await api.obterSessao();
      if (sessao.cuidador_id === null) {
        setCuidadorAtual(null);
        return;
      }
      const lista = await api.listarCuidadores();
      setCuidadorAtual(lista.find((c) => c.id === sessao.cuidador_id) ?? null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const login = useCallback(
    async (email: string, senha: string) => {
      await api.login(email, senha);
      await recarregar();
    },
    [recarregar],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setCuidadorAtual(null);
  }, []);

  return (
    <Ctx.Provider value={{ cuidadorAtual, carregando, erro, login, logout, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCuidador() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCuidador precisa estar dentro de CuidadorProvider");
  return ctx;
}
