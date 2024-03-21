import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";
import { upsertDataInSupabase } from "./libs/syncWithNgenApi";
import { supabase } from "./libs/supabase";
import { Energy, SupabaseEnergyItem } from "./types";
import { cors } from "@elysiajs/cors";

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
  .get("/sync", async ({ store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    await upsertDataInSupabase();

    return "Success";
  })
  .post("/sync", async ({ store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    await delay(10000);

    return "Success";
  })
  .get("/energy", async ({ store, set, query }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

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
  });

new Elysia()
  .use(privateRoutes)
  .get("/", () => "Hello world!")
  .listen(8080);
