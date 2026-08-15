import type {
  Convite,
  Cuidador,
  Dose,
  EventoVinculo,
  Idoso,
  Interacao,
  Medicamento,
  NivelRisco,
  NovoMedicamento,
} from "./tipos";

/** Base curada de interacoes (espelha a base do backend, usada no modo demonstracao). */
const BASE_INTERACOES: Array<{ a: string; b: string; risco: NivelRisco }> = [
  { a: "varfarina", b: "acido acetilsalicilico", risco: "alto" },
  { a: "varfarina", b: "omeprazol", risco: "moderado" },
  { a: "losartana", b: "espironolactona", risco: "alto" },
  { a: "metformina", b: "furosemida", risco: "moderado" },
  { a: "sinvastatina", b: "anlodipino", risco: "moderado" },
  { a: "levotiroxina", b: "omeprazol", risco: "baixo" },
  { a: "sertralina", b: "acido acetilsalicilico", risco: "moderado" },
  { a: "digoxina", b: "furosemida", risco: "alto" },
];

const normalizar = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function buscarInteracao(novo: string, existentes: string[]): Interacao | null {
  const ordem: NivelRisco[] = ["baixo", "moderado", "alto"];
  let melhor: Interacao | null = null;
  for (const existente of existentes) {
    const par = BASE_INTERACOES.find(
      (i) =>
        (normalizar(i.a) === normalizar(novo) && normalizar(i.b) === normalizar(existente)) ||
        (normalizar(i.b) === normalizar(novo) && normalizar(i.a) === normalizar(existente)),
    );
    if (!par) continue;
    const candidata: Interacao = {
      principio_ativo_a: novo,
      principio_ativo_b: existente,
      nivel_risco: par.risco,
    };
    if (!melhor || ordem.indexOf(candidata.nivel_risco) > ordem.indexOf(melhor.nivel_risco)) {
      melhor = candidata;
    }
  }
  return melhor;
}

const agora = Date.now();
/** Deslocamento em minutos a partir de agora — mantem o exemplo coerente com o relogio do usuario. */
const emMinutos = (min: number) => new Date(agora + min * 60000);
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const ATRASADA = emMinutos(-95);
const JA_CONFIRMADA = emMinutos(-12);
const FUTURA = emMinutos(150);

const hoje = (hora: string) => {
  const d = new Date();
  const [h, m] = hora.split(":").map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};

let seq = 100;
const novoId = () => ++seq;

interface EstadoDemo {
  cuidadores: Cuidador[];
  idosos: Idoso[];
  medicamentos: Medicamento[];
  doses: Dose[];
  convites: Convite[];
  historicoVinculo: EventoVinculo[];
  cuidadorAtual: number | null;
}

const cuidadores: Cuidador[] = [
  { id: 1, nome: "Ana Souza", telefone: "(11) 98877-1234", email: "ana@exemplo.com" },
  { id: 2, nome: "Carlos Lima", telefone: "(11) 99123-4455", email: "carlos@exemplo.com" },
  { id: 3, nome: "Marta Ribeiro", telefone: "(21) 98111-7788", email: "marta@exemplo.com" },
];

export const estado: EstadoDemo = {
  cuidadores,
  convites: [],
  historicoVinculo: [],
  cuidadorAtual: null,
  idosos: [
    {
      id: 1,
      nome: "Dona Iracema Alves",
      data_nascimento: "1941-03-12",
      idade: 85,
      observacoes: "Hipertensa, usa marcapasso. Dificuldade para engolir comprimidos grandes.",
      cuidadores: [
        { ...cuidadores[0]!, eh_dono: true },
        { ...cuidadores[1]!, eh_dono: false },
      ],
    },
    {
      id: 2,
      nome: "Seu Antônio Peixoto",
      data_nascimento: "1948-09-30",
      idade: 77,
      observacoes: "Diabético tipo 2. Mora com a filha.",
      cuidadores: [{ ...cuidadores[2]!, eh_dono: true }],
    },
  ],
  medicamentos: [
    {
      id: 11,
      idoso_id: 1,
      nome: "Marevan",
      principio_ativo: "Varfarina",
      dosagem: "5 mg",
      horario: hhmm(ATRASADA),
      frequencia_horas: 24,
      registro_ms: "1.0043.0123",
      ativo: true,
      proximo_horario_previsto: ATRASADA.toISOString(),
      atrasado: true,
    },
    {
      id: 12,
      idoso_id: 1,
      nome: "Losartana Potássica",
      principio_ativo: "Losartana",
      dosagem: "50 mg",
      horario: hhmm(JA_CONFIRMADA),
      frequencia_horas: 12,
      registro_ms: null,
      ativo: true,
      proximo_horario_previsto: JA_CONFIRMADA.toISOString(),
      atrasado: false,
    },
    {
      id: 13,
      idoso_id: 2,
      nome: "Glifage XR",
      principio_ativo: "Metformina",
      dosagem: "850 mg",
      horario: hhmm(FUTURA),
      frequencia_horas: 12,
      registro_ms: null,
      ativo: true,
      proximo_horario_previsto: FUTURA.toISOString(),
      atrasado: false,
    },
  ],
  doses: [
    {
      id: 21,
      medicamento_id: 12,
      horario_previsto: JA_CONFIRMADA.toISOString(),
      confirmado_em: emMinutos(-8).toISOString(),
      observacao: "Tomou com suco de laranja.",
      cuidador: cuidadores[0]!,
    },
    {
      id: 22,
      medicamento_id: 11,
      horario_previsto: new Date(ATRASADA.getTime() - 86400000).toISOString(),
      confirmado_em: new Date(ATRASADA.getTime() - 86400000 + 5 * 60000).toISOString(),
      observacao: null,
      cuidador: cuidadores[1]!,
    },
  ],
};

export const demo = {
  login: (email: string) => {
    const c = estado.cuidadores.find((x) => normalizar(x.email) === normalizar(email));
    if (!c) {
      throw { __apiErro: true, status: 401, mensagem: "Email ou senha incorretos." };
    }
    estado.cuidadorAtual = c.id;
  },
  logout: () => {
    estado.cuidadorAtual = null;
  },
  listarCuidadores: () => [...estado.cuidadores],
  criarCuidador: (dados: { nome: string; telefone: string; email: string; senha: string }) => {
    const c: Cuidador = {
      id: novoId(),
      nome: dados.nome,
      telefone: dados.telefone,
      email: dados.email,
    };
    estado.cuidadores.push(c);
    return c;
  },
  listarIdosos: () => [...estado.idosos],
  obterIdoso: (id: number) => {
    const i = estado.idosos.find((x) => x.id === id);
    if (!i) throw new Error("Não encontramos esse idoso.");
    return i;
  },
  criarIdoso: (dados: { nome: string; data_nascimento: string; observacoes?: string }) => {
    const nasc = new Date(dados.data_nascimento);
    const idade = Math.max(0, Math.floor((Date.now() - nasc.getTime()) / (365.25 * 86400000)));
    const criador = estado.cuidadores.find((c) => c.id === estado.cuidadorAtual);
    const i: Idoso = {
      id: novoId(),
      ...dados,
      idade,
      cuidadores: criador ? [{ ...criador, eh_dono: true }] : [],
    };
    estado.idosos.push(i);
    return i;
  },
  criarConvite: (idosoId: number, email: string) => {
    const i = demo.obterIdoso(idosoId);
    const convidado = estado.cuidadores.find((c) => normalizar(c.email) === normalizar(email));
    if (!convidado) {
      throw {
        __apiErro: true,
        status: 404,
        mensagem: "Não existe cuidador cadastrado com esse email.",
      };
    }
    const solicitante = estado.cuidadores.find((c) => c.id === estado.cuidadorAtual);
    if (!solicitante) {
      throw { __apiErro: true, status: 401, mensagem: "É preciso estar logado." };
    }
    estado.convites = estado.convites.filter(
      (cv) =>
        !(
          cv.idoso_id === idosoId &&
          cv.solicitado_por.id !== convidado.id &&
          cv.status === "pendente"
        ),
    );
    const convite: Convite = {
      id: novoId(),
      idoso_id: idosoId,
      solicitado_por: solicitante,
      status: "pendente",
      criado_em: new Date().toISOString(),
    };
    estado.convites.push(convite);
    void i;
    return convite;
  },
  listarConvites: () => estado.convites.filter((c) => c.status === "pendente"),
  aceitarConvite: (id: number) => {
    const convite = estado.convites.find((c) => c.id === id);
    if (!convite) return;
    convite.status = "aceito";
    const i = demo.obterIdoso(convite.idoso_id);
    const cuidadorAtual = estado.cuidadores.find((c) => c.id === estado.cuidadorAtual);
    if (cuidadorAtual && !i.cuidadores.some((c) => c.id === cuidadorAtual.id)) {
      i.cuidadores.push({ ...cuidadorAtual, eh_dono: false });
    }
  },
  recusarConvite: (id: number) => {
    const convite = estado.convites.find((c) => c.id === id);
    if (convite) convite.status = "recusado";
  },
  desvincularCuidador: (idosoId: number, cuidadorId: number) => {
    const i = demo.obterIdoso(idosoId);
    const atualId = estado.cuidadorAtual;
    if (atualId === null) {
      throw { __apiErro: true, status: 401, mensagem: "É preciso estar logado." };
    }
    const alvo = i.cuidadores.find((c) => c.id === cuidadorId);
    if (!alvo) {
      throw {
        __apiErro: true,
        status: 404,
        mensagem: "Cuidador não encontrado neste idoso.",
      };
    }
    const ehAuto = cuidadorId === atualId;
    const dono = i.cuidadores.find((c) => c.eh_dono);
    if (!ehAuto && dono?.id !== atualId) {
      throw {
        __apiErro: true,
        status: 403,
        mensagem: "Só o cuidador que cadastrou o idoso pode remover outros cuidadores.",
      };
    }
    const remanescentes = i.cuidadores.filter((c) => c.id !== cuidadorId);
    if (alvo.eh_dono) {
      if (remanescentes.length > 0) remanescentes[0]!.eh_dono = true;
    } else if (ehAuto && remanescentes.length === 0) {
      throw {
        __apiErro: true,
        status: 409,
        mensagem: "Não é possível sair: você é o único cuidador vinculado a este idoso.",
      };
    }
    i.cuidadores = remanescentes;
    const executor = estado.cuidadores.find((c) => c.id === atualId) ?? null;
    estado.historicoVinculo.push({
      id: novoId(),
      idoso_id: idosoId,
      cuidador: { ...alvo },
      tipo_evento: ehAuto ? "saiu" : "removido",
      realizado_por: ehAuto ? null : executor,
      criado_em: new Date().toISOString(),
    });
  },
  listarHistoricoVinculo: (idosoId: number) =>
    estado.historicoVinculo
      .filter((e) => e.idoso_id === idosoId)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
  listarMedicamentos: (idosoId: number) =>
    estado.medicamentos.filter((m) => m.idoso_id === idosoId && m.ativo),
  criarMedicamento: (idosoId: number, dados: NovoMedicamento) => {
    const ativos = demo.listarMedicamentos(idosoId);
    const duplicado = ativos.some(
      (m) =>
        normalizar(m.principio_ativo) === normalizar(dados.principio_ativo) &&
        normalizar(m.dosagem) === normalizar(dados.dosagem),
    );
    if (duplicado) {
      throw {
        __apiErro: true,
        status: 400,
        mensagem:
          "Este idoso já tem um remédio ativo com o mesmo princípio ativo e a mesma dosagem.",
      };
    }
    const interacao = buscarInteracao(
      dados.principio_ativo,
      ativos.map((m) => m.principio_ativo),
    );
    if (interacao?.nivel_risco === "alto" && !dados.confirmar_risco_alto) {
      throw {
        __apiErro: true,
        status: 409,
        mensagem: "Este remédio tem risco alto de interação com outro que o idoso já usa.",
        interacao,
      };
    }
    const med: Medicamento = {
      id: novoId(),
      idoso_id: idosoId,
      nome: dados.nome,
      principio_ativo: dados.principio_ativo,
      dosagem: dados.dosagem,
      horario: dados.horario,
      frequencia_horas: dados.frequencia_horas,
      registro_ms: dados.registro_ms ?? null,
      ativo: true,
      proximo_horario_previsto: hoje(dados.horario).toISOString(),
      atrasado: Date.now() - hoje(dados.horario).getTime() > 30 * 60000,
    };
    estado.medicamentos.push(med);
    return { medicamento: med, interacao: interacao ?? null };
  },
  inativarMedicamento: (id: number) => {
    const m = estado.medicamentos.find((x) => x.id === id);
    if (m) m.ativo = false;
  },
  atualizarMedicamento: (id: number, dados: Partial<NovoMedicamento>) => {
    const m = estado.medicamentos.find((x) => x.id === id);
    if (!m) throw new Error("Não encontramos esse medicamento.");
    Object.assign(m, dados);
    if (dados.horario) {
      m.proximo_horario_previsto = hoje(dados.horario).toISOString();
      m.atrasado = Date.now() - hoje(dados.horario).getTime() > 30 * 60000;
    }
    return m;
  },
  confirmarDose: (medicamentoId: number, observacao?: string) => {
    const med = estado.medicamentos.find((x) => x.id === medicamentoId);
    if (!med) throw new Error("Não encontramos esse medicamento.");
    const cuidador = estado.cuidadores.find((c) => c.id === estado.cuidadorAtual);
    if (!cuidador) {
      throw {
        __apiErro: true,
        status: 401,
        mensagem: "Escolha quem está usando o app antes de confirmar uma dose.",
      };
    }
    const existente = estado.doses.find(
      (d) =>
        d.medicamento_id === medicamentoId && d.horario_previsto === med.proximo_horario_previsto,
    );
    if (existente) {
      throw {
        __apiErro: true,
        status: 409,
        mensagem: "Esta dose já foi confirmada por outro cuidador.",
        dose: existente,
      };
    }
    if (new Date(med.proximo_horario_previsto).getTime() > Date.now()) {
      throw {
        __apiErro: true,
        status: 400,
        mensagem: "Ainda não chegou o horário desta dose. Não é possível confirmar antes da hora.",
      };
    }
    const dose: Dose = {
      id: novoId(),
      medicamento_id: medicamentoId,
      horario_previsto: med.proximo_horario_previsto,
      confirmado_em: new Date().toISOString(),
      observacao: observacao?.trim() ? observacao.trim() : null,
      cuidador,
    };
    estado.doses.push(dose);
    med.proximo_horario_previsto = new Date(
      new Date(med.proximo_horario_previsto).getTime() + med.frequencia_horas * 3600000,
    ).toISOString();
    med.atrasado = false;
    return dose;
  },
  listarDoses: (idosoId: number) => {
    const ids = estado.medicamentos.filter((m) => m.idoso_id === idosoId).map((m) => m.id);
    return estado.doses
      .filter((d) => ids.includes(d.medicamento_id))
      .sort((a, b) => b.confirmado_em.localeCompare(a.confirmado_em));
  },
};
