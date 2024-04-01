import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";
import { upsertDataInSupabase } from "./libs/syncWithNgenApi";
import { supabase } from "./libs/supabase";
import { Energy, SupabaseEnergyItem, SyncHistory } from "./types";
import { cors } from "@elysiajs/cors";

const port = process.env.PORT ?? 3000;

async function delay(milliseconds: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const privateRoutes = new Elysia({ prefix: "/api" })
  .use(cors())
  .use(clerkPlugin())
  .get("/user", async ({ clerk, store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    const user = await clerk.users.getUser(store.auth.userId);

    return { user };
  })

  .post("/sync", async ({ set }) => {
    try {
      await upsertDataInSupabase();

      set.status = 201;
      return "Success";
    } catch (error) {
      console.error("Error during sync:", error);
      set.status = 500;
      return error;
    }
  })
  .get("/energy", async ({ set, query }) => {
    const { dateFrom, dateTo } = query;

    try {
      let query = supabase
        .from("energy")
        .select("*")
        .order("date", { ascending: false });

      if (dateTo) {
        query = query.lte("date", dateTo);
      }
      if (dateFrom) {
        query = query.gte("date", dateFrom);
      }

      let { data } = await query;

      const energy = (data as SupabaseEnergyItem[]) ?? [];

      const groupedEnergy: Energy[] = energy.reduce((acc: Energy[], item) => {
        const existingItem = acc.find((group) => group.date === item.date);

        if (existingItem) {
          existingItem.energyMade += item.energyMade;
          existingItem.energyWasted += item.energyWasted;
        } else {
          acc.push({
            created_at: item.created_at,
            date: item.date,
            energyMade: item.energyMade,
            energyWasted: item.energyWasted,
          });
        }

        return acc;
      }, []);

      return groupedEnergy.filter(
        (energyItem) =>
          energyItem.energyMade !== 0 && energyItem.energyWasted !== 0
      );
    } catch (e) {
      console.log(e);
      set.status = 500;
      return "Server error";
    }
  })
  .get("/sync-history", async ({ set }) => {
    try {
      let query = supabase
        .from("sync-history")
        .select("*")
        .order("created_at", { ascending: true })
        .range(0, 4);

      let { data } = await query;

      const syncHistory = (data as SyncHistory[]) ?? [];

      return syncHistory;
    } catch (e) {
      console.log(e);
      set.status = 500;
      return "Server error";
    }
  });

new Elysia()
  .use(privateRoutes)
  .get("/", () => "Hello world!")
  .listen(port);
