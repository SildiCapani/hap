import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, Check, Search } from "lucide-react-native";
import { localStamp, newId } from "@/lib/planner";
import { lookupBarcode, portion, type Product } from "@/lib/food";
import { usePlanner } from "@/lib/store";
import { tap } from "@/lib/notify";
import { Button, C, Chip, Sheet, s, useToday } from "./planner-ui";

// Scan a packaged food, pick the amount, save exact values from Open Food Facts.
export function BarcodeSheet({ close }: { close: () => void }) {
  const { update } = usePlanner();
  const today = useToday();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState("100");
  async function find(value: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await lookupBarcode(value);
    setBusy(false);
    if (typeof result === "string") return setError(result);
    tap("success");
    setProduct(result);
    setGrams(String(result.serving || 100));
  }
  const amount = Math.max(0, Number(grams.replace(",", ".")) || 0);
  const values = product ? portion(product, amount) : null;
  function save() {
    if (!product || !values || !amount) return;
    tap("success");
    update((prev) => ({
      ...prev,
      foodLog: [
        ...prev.foodLog,
        {
          id: newId("food"),
          date: today,
          time: localStamp().slice(11),
          name:
            product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase())
              ? product.brand + " " + product.name
              : product.name,
          ...values,
          items: [{ name: product.name, amount: amount + " g", kcal: values.kcal }],
          source: "barcode",
        },
      ],
    }));
    close();
  }
  return (
    <Sheet
      title={product ? product.name : "Barcode scannen"}
      subtitle={product ? (product.brand ? product.brand + " · " : "") + "Werte von Open Food Facts" : "Halte den Barcode der Verpackung in den Rahmen."}
      close={close}
      footer={
        product ? (
          <>
            <Button quiet onPress={() => setProduct(null)}>Neu scannen</Button>
            <Button icon={Check} disabled={!amount} onPress={save}>Speichern</Button>
          </>
        ) : undefined
      }
    >
      {!product ? (
        <>
          {permission?.granted ? (
            <View style={{ height: 240, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                onBarcodeScanned={busy ? undefined : (result) => {
                  setCode(result.data);
                  void find(result.data);
                }}
              />
              <View pointerEvents="none" style={{ position: "absolute", left: "12%", right: "12%", top: "38%", height: "24%", borderWidth: 2, borderColor: "#F07B83", borderRadius: 10 }} />
            </View>
          ) : (
            <Button icon={Camera} onPress={() => void requestPermission()}>
              Kamera erlauben
            </Button>
          )}
          <View style={[s.row, { gap: 8 }]}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="oder Nummer eintippen, z. B. 4000417025005"
              placeholderTextColor="#7E7887"
              keyboardType="number-pad"
              accessibilityLabel="Barcode-Nummer"
              style={[s.input, { flex: 1 }]}
            />
            <Button quiet icon={Search} disabled={busy || code.replace(/\D/g, "").length < 8} onPress={() => void find(code)}>
              Suchen
            </Button>
          </View>
          {busy && <ActivityIndicator color={C.green} />}
        </>
      ) : (
        values && (
          <>
            <Text style={s.micro}>
              Pro 100 g: {product.per100.kcal} kcal · P {product.per100.protein} g · K {product.per100.carbs} g · F {product.per100.fat} g
            </Text>
            <View>
              <Text style={s.label}>Wie viel hast du gegessen?</Text>
              <View style={s.wrap}>
                {product.serving > 0 && <Chip label={"1 Portion (" + product.serving + " g)"} active={amount === product.serving} onPress={() => setGrams(String(product.serving))} />}
                <Chip label="100 g" active={amount === 100} onPress={() => setGrams("100")} />
                {product.pack > 0 && <Chip label={"Ganze Packung (" + product.pack + " g)"} active={amount === product.pack} onPress={() => setGrams(String(product.pack))} />}
              </View>
              <TextInput
                value={grams}
                onChangeText={setGrams}
                keyboardType="decimal-pad"
                accessibilityLabel="Menge in Gramm"
                style={[s.input, { marginTop: 10 }]}
              />
            </View>
            <View style={[s.row, { justifyContent: "space-around", padding: 14, borderRadius: 12, backgroundColor: "#202127" }]}>
              {(
                [
                  ["kcal", values.kcal + ""],
                  ["Protein", values.protein + " g"],
                  ["Kohlenh.", values.carbs + " g"],
                  ["Fett", values.fat + " g"],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={{ alignItems: "center" }}>
                  <Text style={[s.h3, { fontSize: 17 }]}>{value}</Text>
                  <Text style={s.micro}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        )
      )}
      {error ? <Text style={[s.body, { color: "#F3A4A9", lineHeight: 21 }]}>{error}</Text> : null}
    </Sheet>
  );
}
