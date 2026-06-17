// Catálogo de segmentos de atuação e tipos de equipamento sugeridos.
// O `dbEnum` mapeia para o enum existente em ordens_servico.tipo_equipamento.
// Tipos muito específicos (ex: "Carregador de Drone") são salvos como 'outro'
// no enum e a label real é preservada via SmartSelect/observacoes.

export type EquipmentType = {
  value: string;     // identificador único do item (estável)
  label: string;     // o que aparece no select
  dbEnum: string;    // enum aceito por tipo_equipamento no banco
};

export type Segmento = {
  key: string;
  label: string;
  types: EquipmentType[];
};

export const SEGMENTOS: Segmento[] = [
  {
    key: 'drones',
    label: 'Drones',
    types: [
      { value: 'drone_agricola', label: 'Drone Agrícola', dbEnum: 'drone_agricola' },
      { value: 'drone_imagem', label: 'Drone de Imagem / Enterprise', dbEnum: 'drone_convencional' },
      { value: 'bateria_drone', label: 'Bateria Inteligente', dbEnum: 'bateria' },
      { value: 'controle_smart', label: 'Controle Remoto (Smart Controller)', dbEnum: 'controle' },
      { value: 'carregador_drone', label: 'Carregador de Drone', dbEnum: 'outro' },
    ],
  },
  {
    key: 'mobilidade',
    label: 'Mobilidade Elétrica',
    types: [
      { value: 'patinete_eletrico', label: 'Patinete Elétrico', dbEnum: 'patinete_eletrico' },
      { value: 'bicicleta_eletrica', label: 'Bicicleta Elétrica', dbEnum: 'bicicleta_eletrica' },
      { value: 'moto_eletrica', label: 'Moto / Scooter Elétrica', dbEnum: 'moto_eletrica' },
      { value: 'bateria_litio', label: 'Bateria de Lítio', dbEnum: 'bateria' },
      { value: 'carregador_bms', label: 'Carregador BMS', dbEnum: 'outro' },
      { value: 'outros_autopropelidos', label: 'Outros Autopropelidos', dbEnum: 'outros_autopropelidos' },
    ],
  },
  {
    key: 'informatica',
    label: 'Informática',
    types: [
      { value: 'computador', label: 'Computador', dbEnum: 'outro' },
      { value: 'notebook', label: 'Notebook', dbEnum: 'outro' },
      { value: 'monitor', label: 'Monitor', dbEnum: 'outro' },
      { value: 'memoria_ram', label: 'Memória RAM', dbEnum: 'outro' },
      { value: 'placa_video', label: 'Placa de Vídeo', dbEnum: 'outro' },
    ],
  },
  {
    key: 'bicicletaria',
    label: 'Bicicletaria',
    types: [
      { value: 'bicicleta_convencional', label: 'Bicicleta Convencional', dbEnum: 'outro' },
      { value: 'amortecedor', label: 'Amortecedor', dbEnum: 'outro' },
      { value: 'raio_bicicleta', label: 'Raio de Bicicleta', dbEnum: 'outro' },
      { value: 'cambio', label: 'Câmbio / Transmissão', dbEnum: 'outro' },
    ],
  },
];

export type CustomType = { value: string; label: string };

/** Calcula tipos visíveis: segmentos selecionados + customizados. */
export function getAvailableTypes(
  selectedSegments: string[],
  customTypes: CustomType[] = []
): EquipmentType[] {
  const segs = selectedSegments?.length ? selectedSegments : SEGMENTOS.map(s => s.key); // fallback: tudo
  const fromSegs = SEGMENTOS
    .filter(s => segs.includes(s.key))
    .flatMap(s => s.types);
  const customs: EquipmentType[] = customTypes.map(c => ({
    value: c.value,
    label: c.label,
    dbEnum: 'outro',
  }));
  // dedupe by value
  const seen = new Set<string>();
  return [...fromSegs, ...customs].filter(t => {
    if (seen.has(t.value)) return false;
    seen.add(t.value);
    return true;
  });
}

export function findTypeByValue(
  value: string,
  selectedSegments: string[],
  customTypes: CustomType[] = []
): EquipmentType | undefined {
  return getAvailableTypes(selectedSegments, customTypes).find(t => t.value === value);
}
