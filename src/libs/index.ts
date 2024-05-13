import {
  MeasuringPoints,
  SupabaseEnergyItem,
  WeatherApiResponse,
} from "../types";
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

export const getWeatherData = async (lastInsertedDate: Date) => {
  try {
    const today = new Date();

    const latitude = 45.9576254;
    const longitude = 14.6531854;

    const startDateFormat = lastInsertedDate.toISOString().split("T")[0];
    const endDateFormat = today.toISOString().split("T")[0];

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDateFormat}&end_date=${endDateFormat}&daily=temperature_2m_max,daylight_duration&timezone=Europe%2FBerlin`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Network response getWeatherData was not ok");
    }

    const data: WeatherApiResponse = await response.json();

    return data;
  } catch (error) {
    console.log(error);
  }
};

export const getTempAndDaylightDataForDate = (
  weatherResponse: WeatherApiResponse,
  date: string
) => {
  const indexOfWeatherDate = weatherResponse.daily.time.findIndex(
    (time) => time === date
  );

  return {
    maximumTemperature:
      weatherResponse.daily.temperature_2m_max[indexOfWeatherDate],
    daylightDurationInSeconds:
      weatherResponse.daily.daylight_duration[indexOfWeatherDate],
  };
};
