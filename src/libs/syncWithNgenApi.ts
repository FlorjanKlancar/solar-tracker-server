import { GRO_MOCK_DATA, KOBILJEK_MOCK_DATA } from ".";
import { NgenEnergyItem, SupabaseEnergyItem } from "../types";
import { supabase } from "./supabase";

const NGEN_API_URL =
  "https://ps.ngen.si/api/1.0/measuring_points.measurments_model?measuring_point_id=857&date[gte]=%222024-02-10%2000:00:00%22&date[lte]=%222024-03-11%2000:00:00%22";

const GRO_MEASURING_ID = "857";
const GRO_UUID = "f1e8840b47764d4a9daf9a43c61efc7f";
const GRO_ID = "b7a5747fe531601e9b5dd50742d554b32b6d84b1";

const KOBILJEK_MEASURING_ID = "856";
const KOBILJEK_UUID = "423bd042a5644b3cb7df1cb851a52d90";
const KOBILJEK_ID = "109c4175cbdbc45a00816817701d92dde593df1f";

const API_KEY = "22f4425e-1b44-44a5-bd86-667b800b3b9b";

const constructApiUrlWithParams = (
  lastInsertedDate: Date,
  MEASURING_ID: string
) => {
  const currentDate = new Date();

  const formattedLastDate = lastInsertedDate
    ? new Date(lastInsertedDate).toISOString()
    : null;
  const formattedCurrentDate = currentDate
    ? new Date(currentDate).toISOString()
    : null;

  const queryParams = [];

  if (formattedLastDate) {
    const encodedLastDate = encodeURIComponent(`"${formattedLastDate}"`);
    queryParams.push(`date[gte]=${encodedLastDate}`);
  }

  if (formattedCurrentDate) {
    const encodedCurrentDate = encodeURIComponent(`"${formattedCurrentDate}"`);
    queryParams.push(`date[lte]=${encodedCurrentDate}`);
  }

  const apiUrl = `https://ps.ngen.si/api/1.0/measuring_points.measurments_model?measuring_point_id=${MEASURING_ID}${queryParams}`;

  return apiUrl;
};

const syncWithNgenApi = async (
  lastInsertedDate: Date,
  ID: string,
  UUID: string,
  MEASURING_ID: string
): Promise<NgenEnergyItem[]> => {
  if (ID === "b7a5747fe531601e9b5dd50742d554b32b6d84b1") return GRO_MOCK_DATA;
  else return KOBILJEK_MOCK_DATA;

  const apiUrl = constructApiUrlWithParams(lastInsertedDate, MEASURING_ID);

  try {
    const headers = new Headers();

    headers.append("visitor_uuid", UUID);
    headers.append("session_id", ID);
    headers.append("Api383994619958244", API_KEY);

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

    console.log("lastInsertedDate", lastInsertedDate);

    const ngenResponseForGro = await syncWithNgenApi(
      lastInsertedDate,
      GRO_ID,
      GRO_UUID,
      GRO_MEASURING_ID
    );

    const ngenResponseForKobiljek = await syncWithNgenApi(
      lastInsertedDate,
      KOBILJEK_ID,
      KOBILJEK_UUID,
      KOBILJEK_MEASURING_ID
    );

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

      await supabase.from("energy").upsert([upsertData]);
    });

    await Promise.all([upsertPromisesGro, upsertPromisesKobiljek]);
  } catch (e) {
    console.log(e);
  }
};

const getLastInsertedDate = (energy: SupabaseEnergyItem[]): Date => {
  if (energy.length === 0) {
    return new Date("2024-01-01"); // start of solar collecting
  }

  const lastInsertedDate = energy.reduce((maxDate, item) => {
    const itemDate = new Date(item.date);
    return itemDate > maxDate ? itemDate : maxDate;
  }, new Date(0));

  return lastInsertedDate;
};
