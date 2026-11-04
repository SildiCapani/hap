import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { CloudOff, RefreshCw, X } from "lucide-react-native";
import { newVersionAvailable } from "@/lib/update";
import { usePlanner } from "@/lib/store";
import { C, s } from "./planner-ui";

// Keeps every device on the same version and the same data: offers a newer
// deploy (and takes it by itself after a longer break), and says when this
// device does not sync yet.
export function DeviceBanner() {
  const { state, ready, cloud } = usePlanner();
  const [fresh, setFresh] = useState(false);
  const [hidden, setHidden] = useState(false);
  const away = useRef(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let alive = true;
    const check = async (reload: boolean) => {
      if (!(await newVersionAvailable()) || !alive) return;
      // Back after 10+ minutes: nothing is half typed, just load it.
      if (reload) window.location.reload();
      else setFresh(true);
    };
    const first = setTimeout(() => void check(false), 4000);
    const timer = setInterval(() => void check(false), 30 * 60 * 1000);
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") {
        away.current = Date.now();
        return;
      }
      const long = !!away.current && Date.now() - away.current > 10 * 60 * 1000;
      void check(long);
    });
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const offline = ready && !state.accessToken;
  const undecided = ready && !!cloud.pending;
  if (fresh)
    return (
      <Bar icon={RefreshCw} text="Neue Version von Hap ist da." action="Aktualisieren" onPress={() => window.location.reload()} />
    );
  if (hidden || !(offline || undecided)) return null;
  return (
    <Bar
      icon={CloudOff}
      text={undecided ? "Dieses Gerät synchronisiert noch nicht: Entscheide einmal, welche Daten gelten." : "Dieses Gerät synchronisiert nicht. Mit deinem App-Zugang hast du auf PC und Handy dasselbe."}
      action={undecided ? "Entscheiden" : "Einrichten"}
      onPress={() => router.push("/settings" as "/")}
      close={() => setHidden(true)}
    />
  );
}

function Bar({ icon: Icon, text, action, onPress, close }: { icon: typeof X; text: string; action: string; onPress: () => void; close?: () => void }) {
  return (
    <View style={[s.row, { gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#1E1A2A", borderBottomWidth: 1, borderBottomColor: "#3A3150" }]}>
      <Icon size={16} color="#C4A3EF" />
      <Text style={[s.micro, { flex: 1, color: C.ink, lineHeight: 17 }]}>{text}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
        <Text style={[s.link, { color: "#C4A3EF" }]}>{action}</Text>
      </Pressable>
      {close ? (
        <Pressable accessibilityLabel="Hinweis ausblenden" onPress={close} hitSlop={8}>
          <X size={15} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
