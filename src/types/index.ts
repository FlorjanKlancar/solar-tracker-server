export type NgenEnergyItem = {
  id: number;
  amountDiff: number;
  amountEnN: number;
  amountEnP: number;
  date: string;
  enDiff: number;
  enN: number;
  enP: number;
  energy_difference: number;
  measuring_point_id: number;
  partner_id: number;
  received_energy: number;
  sent_energy: number;
};

export type SupabaseEnergyItem = {
  id: number;
  created_at: string;
  date: string;
  energyMade: number;
  energyWasted: number;
  measuringPointId: number;
};

export type Energy = {
  created_at: string;
  date: string;
  energyMade: number;
  energyWasted: number;
};

export type SyncHistory = {
  id: string;
  created_at: string;
  numberOfInserts: number;
};

export type MeasuringPoints = {
  id: string;
  created_at: string;
  name: string;
  pointId: string;
  pointUUID: string;
  measuringId: string;
  apiKey: string;
};
