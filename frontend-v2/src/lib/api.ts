import axios, { AxiosError } from "axios";
import { demo, estado } from "./dados-exemplo";
import type { Cuidador, Dose, Idoso, Interacao, Medicamento, NovoMedicamento } from "./tipos";

const baseURL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

export const http = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

/** Erro de negocio ja traduzido para linguagem simples. */
export class ApiError extends Error {
  status: number;
  interacao?: Interacao | undefined;
  dose?: Dose | undefined;
  constructor(
    mensagem: string,
    status: number,
    extras?: { interacao?: Interacao | undefined; dose?: Dose | undefined },
  ) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.interacao = extras?.interacao;
    this.dose = extras?.dose;
  }
}

/* ---------- modo demonstracao ---------- */

let modoDemo = false;
const ouvintes = new Set<(v: boolean) => void>();

export const estaEmModoDemo = () => modoDemo;
export function observarModoDemo(fn: (v: boolean) => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function definirModoDemo(v: boolean) {
  if (modoDemo === v) return;
  modoDemo = v;
  ouvintes.forEach((f) => f(v));
}

function mensagemLegivel(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (typeof d["mensagem"] === "string") return d["mensagem"] as string;
  }
  return fallback;
}

function traduzir(erro: unknown): ApiError {
  const ax = erro as AxiosError<{ detail?: unknown }>;
  const status = ax.response?.status ?? 0;
  const detail = ax.response?.data?.detail as Record<string, unknown> | string | undefined;
  const extras: { interacao?: Interacao | undefined; dose?: Dose | undefined } = {};
  if (detail && typeof detail === "object") {
    if ((detail as Record<string, unknown>)["interacao"]) {
      extras.interacao = (detail as Record<string, unknown>)["interacao"] as Interacao;
    }
    if ((detail as Record<string, unknown>)["dose"]) {
      extras.dose = (detail as Record<string, unknown>)["dose"] as Dose;
    }
    if (
      !extras.dose &&
      (detail as Record<string, unknown>)["confirmado_em"] &&
      (detail as Record<string, unknown>)["cuidador"]
    ) {
      extras.dose = detail as unknown as Dose;
    }
  }
  const padrao =
    status >= 500
      ? "O servidor teve um problema ao responder. Tente novamente em instantes."
      : "Não foi possível concluir esta ação. Confira os dados e tente de novo.";
  return new ApiError(mensagemLegivel(detail, padrao), status, extras);
}

/** Converte o erro simulado do modo demonstracao em ApiError. */
function traduzirDemo(erro: unknown): never {
  const e = erro as Record<string, unknown>;
  if (e && e["__apiErro"]) {
    throw new ApiError(e["mensagem"] as string, e["status"] as number, {
      interacao: e["interacao"] as Interacao | undefined,
      dose: e["dose"] as Dose | undefined,
    });
  }
  throw new ApiError(erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.", 0);
}

/** Tenta o backend real; se ele estiver fora do ar, usa os dados de exemplo. */
async function chamar<T>(real: () => Promise<T>, exemplo: () => T): Promise<T> {
  if (modoDemo) {
    try {
      const r = await real();
      definirModoDemo(false);
      return r;
    } catch (erro) {
      const ax = erro as AxiosError;
      if (ax.response) throw traduzir(erro);
      try {
        return exemplo();
      } catch (e) {
        traduzirDemo(e);
      }
    }
  }
  try {
    return await real();
  } catch (erro) {
    const ax = erro as AxiosError;
    if (ax.response) throw traduzir(erro);
    definirModoDemo(true);
    try {
      return exemplo();
    } catch (e) {
      traduzirDemo(e);
    }
  }
}

/* ---------- endpoints ---------- */

export const api = {
  obterSessao: () =>
    chamar<{ cuidador_id: number | null }>(
      async () => (await http.get("/sessao")).data,
      () => ({ cuidador_id: estado.cuidadorAtual }),
    ),
  definirSessao: (cuidador_id: number) =>
    chamar<{ cuidador_id: number | null }>(
      async () => (await http.post("/sessao", { cuidador_id })).data,
      () => {
        estado.cuidadorAtual = cuidador_id;
        return { cuidador_id };
      },
    ),

  listarCuidadores: () =>
    chamar<Cuidador[]>(
      async () => (await http.get("/cuidadores")).data,
      () => demo.listarCuidadores(),
    ),
  criarCuidador: (dados: { nome: string; telefone: string }) =>
    chamar<Cuidador>(
      async () => (await http.post("/cuidadores", dados)).data,
      () => demo.criarCuidador(dados),
    ),

  listarIdosos: () =>
    chamar<Idoso[]>(
      async () => (await http.get("/idosos")).data,
      () => demo.listarIdosos(),
    ),
  obterIdoso: (id: number) =>
    chamar<Idoso>(
      async () => (await http.get(`/idosos/${id}`)).data,
      () => demo.obterIdoso(id),
    ),
  criarIdoso: (dados: { nome: string; data_nascimento: string; observacoes?: string }) =>
    chamar<Idoso>(
      async () => (await http.post("/idosos", dados)).data,
      () => demo.criarIdoso(dados),
    ),
  vincularCuidador: (idosoId: number, cuidadorId: number) =>
    chamar<void>(
      async () => {
        await http.post(`/idosos/${idosoId}/cuidadores/${cuidadorId}`);
      },
      () => demo.vincular(idosoId, cuidadorId),
    ),

  listarMedicamentos: (idosoId: number) =>
    chamar<Medicamento[]>(
      async () => (await http.get(`/idosos/${idosoId}/medicamentos`)).data,
      () => demo.listarMedicamentos(idosoId),
    ),
  criarMedicamento: (idosoId: number, dados: NovoMedicamento) =>
    chamar<{ medicamento: Medicamento; interacao: Interacao | null }>(
      async () => (await http.post(`/idosos/${idosoId}/medicamentos`, dados)).data,
      () => demo.criarMedicamento(idosoId, dados),
    ),
  atualizarMedicamento: (id: number, dados: Partial<NovoMedicamento>) =>
    chamar<Medicamento>(
      async () => (await http.patch(`/medicamentos/${id}`, dados)).data,
      () => demo.atualizarMedicamento(id, dados),
    ),
  removerMedicamento: (id: number) =>
    chamar<void>(
      async () => {
        await http.delete(`/medicamentos/${id}`);
      },
      () => demo.inativarMedicamento(id),
    ),

  confirmarDose: (medicamentoId: number, observacao?: string) =>
    chamar<Dose>(
      async () => (await http.post(`/medicamentos/${medicamentoId}/doses`, { observacao })).data,
      () => demo.confirmarDose(medicamentoId, observacao),
    ),
  listarDoses: (idosoId: number) =>
    chamar<Dose[]>(
      async () => (await http.get(`/idosos/${idosoId}/doses`)).data,
      () => demo.listarDoses(idosoId),
    ),
};

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.message;
  return "Não conseguimos falar com o servidor agora. Verifique sua conexão e tente novamente.";
}
