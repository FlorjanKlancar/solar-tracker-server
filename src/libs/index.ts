import { MeasuringPoints, SupabaseEnergyItem } from "../types";
import { supabase } from "./supabase";

export const constructUrlWithParams = (
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
    queryParams.push(`&date[lte]=${encodedCurrentDate}`);
  }

  const apiUrl = `https://ps.ngen.si/api/1.0/measuring_points.measurments_model?measuring_point_id=${MEASURING_ID}&${queryParams}`;

  return apiUrl;
};

export const getLastInsertedDate = (energy: SupabaseEnergyItem[]): Date => {
  if (energy.length === 0) {
    return new Date("2024-01-01"); // start of solar collecting
  }

  const lastInsertedDate = energy.reduce((maxDate, item) => {
    const itemDate = new Date(item.date);
    return itemDate > maxDate ? itemDate : maxDate;
  }, new Date(0));

  return lastInsertedDate;
};

export const insertSyncRow = async (numberOfInserts: number) => {
  try {
    await supabase.from("sync-history").insert([{ numberOfInserts }]);
  } catch (error) {
    console.log(error);
    throw new Error("insertSyncRow error");
  }
};

export const getMeasuringPoints = async () => {
  try {
    const response = await supabase.from("measuring-points").select("*");

    return response.data as MeasuringPoints[];
  } catch (error) {
    console.log(error);
    throw new Error("getMeasuringPoints error");
  }
};
