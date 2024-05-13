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
  .get("/auth", async ({ clerk, store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    const user = await clerk.users.getUser(store.auth.userId);

    return { user };
  })

  .get("/users", async ({ clerk, store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    const users = await clerk.users.getUserList();

    const filterUsers = users.filter((user) => user.id !== store.auth?.userId);

    return filterUsers;
  })

  .post("/users/:userId/disable", async ({ params, clerk, store, set }) => {
    if (!store.auth?.userId) {
      set.status = 403;
      return "Unauthorized";
    }

    const { userId } = params;

    try {
      await delay(1000);

      return "User disabled successfully";
    } catch (e) {
      console.error("Error disabling user:", e);
      set.status = 500;
      return e;
    }
  })

  .post("/sync", async ({ set }) => {
    try {
      await upsertDataInSupabase();

      set.status = 201;
      return "Success";
    } catch (e) {
      console.error("Error during sync:", e);
      set.status = 500;
      return e;
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
      return e;
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
      return e;
    }
  });

new Elysia()
  .use(privateRoutes)
  .get("/", () => "Hello world!")
  .listen(port);
