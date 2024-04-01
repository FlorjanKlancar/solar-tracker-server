import {
  constructUrlWithParams,
  getLastInsertedDate,
  getMeasuringPoints,
  insertSyncRow,
} from ".";
import { NgenEnergyItem, SupabaseEnergyItem } from "../types";
import { supabase } from "./supabase";

const syncWithNgenApi = async (
  lastInsertedDate: Date,
  ID: string,
  UUID: string,
  MEASURING_ID: string,
  API_KEY: string
): Promise<NgenEnergyItem[] | undefined> => {
  const apiUrl = constructUrlWithParams(lastInsertedDate, MEASURING_ID);

  try {
    const headers = new Headers();

    headers.append("visitor_uuid", UUID);
    headers.append("session_id", ID);
    headers.append("Api383994619958244", API_KEY);
    headers.append("Authorization", "API383994619958244");

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data: NgenEnergyItem[] = await response.json();

    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const upsertDataInSupabase = async () => {
  try {
    let { data, error } = await supabase.from("energy").select("*");
    const energy = data as SupabaseEnergyItem[];

    if (error) {
      throw new Error("Error fetching supabase");
    }

    const lastInsertedDate = getLastInsertedDate(energy);

    const measuringPoints = await getMeasuringPoints();

    const GRO_INFO = measuringPoints.find(
      (point) => point.measuringId === "857"
    );
    const HOME_INFO = measuringPoints.find(
      (point) => point.measuringId === "856"
    );

    if (!GRO_INFO || !HOME_INFO)
      throw new Error("Error fetching measuring points");

    const ngenResponseForGro = await syncWithNgenApi(
      lastInsertedDate,
      GRO_INFO.pointId,
      GRO_INFO.pointUUID,
      GRO_INFO.measuringId,
      GRO_INFO.apiKey
    );

    const ngenResponseForKobiljek = await syncWithNgenApi(
      lastInsertedDate,
      HOME_INFO.pointId,
      HOME_INFO.pointUUID,
      HOME_INFO.measuringId,
      HOME_INFO.apiKey
    );

    if (!ngenResponseForGro || !ngenResponseForKobiljek)
      throw new Error("Ngen API error");

    const upsertPromisesGro = ngenResponseForGro.map(async (item) => {
      const existingData = energy.find((e) => {
        const existingDate = new Date(e.date);
        const itemDate = new Date(item.date);

        return (
          e.measuringPointId === item.measuring_point_id &&
          existingDate.getFullYear() === itemDate.getFullYear() &&
          existingDate.getMonth() === itemDate.getMonth() &&
          existingDate.getDate() === itemDate.getDate()
        );
      });

      const upsertData = {
        date: item.date,
        energyMade: item.enN,
        energyWasted: item.enP,
        measuringPointId: item.measuring_point_id,
        ...(existingData && existingData.id ? { id: existingData.id } : {}),
      };

      await supabase.from("energy").upsert([upsertData]);
    });

    const upsertPromisesKobiljek = ngenResponseForKobiljek.map(async (item) => {
      const existingData = energy.find((e) => {
        const existingDate = new Date(e.date);
        const itemDate = new Date(item.date);

        return (
          e.measuringPointId === item.measuring_point_id &&
          existingDate.getFullYear() === itemDate.getFullYear() &&
          existingDate.getMonth() === itemDate.getMonth() &&
          existingDate.getDate() === itemDate.getDate()
        );
      });

      const upsertData = {
        date: item.date,
        energyMade: item.enN,
        energyWasted: item.enP,
        measuringPointId: item.measuring_point_id,
        ...(existingData && existingData.id ? { id: existingData.id } : {}),
      };

      console.log({ upsertData });

      await supabase.from("energy").upsert([upsertData]);
    });

    await Promise.all([upsertPromisesGro, upsertPromisesKobiljek]);

    const totalRowsInserted =
      upsertPromisesGro.length + upsertPromisesKobiljek.length - 2;

    await insertSyncRow(totalRowsInserted);
  } catch (e) {
    console.log(e);
    throw new Error("upsertDataInSupabase error");
  }
};
