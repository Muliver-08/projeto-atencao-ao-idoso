export type NivelRisco = "baixo" | "moderado" | "alto";

export interface Cuidador {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  /** Presente quando o cuidador vem de dentro de Idoso.cuidadores: é quem cadastrou o idoso. */
  eh_dono?: boolean;
}

export type StatusConvite = "pendente" | "aceito" | "recusado";

export interface Convite {
  id: number;
  idoso_id: number;
  solicitado_por: Cuidador;
  status: StatusConvite;
  criado_em: string;
}

export interface Idoso {
  id: number;
  nome: string;
  data_nascimento: string;
  idade: number;
  observacoes?: string | null;
  cuidadores: Cuidador[];
}

export interface Medicamento {
  id: number;
  idoso_id: number;
  nome: string;
  principio_ativo: string;
  dosagem: string;
  horario: string;
  frequencia_horas: number;
  registro_ms?: string | null;
  ativo: boolean;
  proximo_horario_previsto: string;
  atrasado: boolean;
}

export interface Interacao {
  principio_ativo_a: string;
  principio_ativo_b: string;
  nivel_risco: NivelRisco;
}

export interface Dose {
  id: number;
  medicamento_id: number;
  horario_previsto: string;
  confirmado_em: string;
  observacao?: string | null;
  cuidador: Cuidador;
}

export type TipoEventoVinculo = "saiu" | "removido";

export interface EventoVinculo {
  id: number;
  idoso_id: number;
  cuidador: Cuidador;
  tipo_evento: TipoEventoVinculo;
  realizado_por: Cuidador | null;
  criado_em: string;
}

export interface NovoMedicamento {
  nome: string;
  principio_ativo: string;
  dosagem: string;
  horario: string;
  frequencia_horas: number;
  registro_ms?: string;
  confirmar_risco_alto?: boolean;
}
