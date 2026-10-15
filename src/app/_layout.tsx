import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PlannerProvider } from "@/lib/store";
import "@/global.css";

export default function RootLayout() {
  return (
    <PlannerProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#121316" },
          animation: "fade",
        }}
      />
    </PlannerProvider>
  );
}

