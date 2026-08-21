import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SessaoProvider, useSessao } from "../src/sessao";
import { CORES } from "../src/config";

function Portao() {
  const { pronto, logado } = useSessao();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!pronto) return;
    const naTelaEntrar = segments[0] === "entrar";
    if (!logado && !naTelaEntrar) router.replace("/entrar");
    if (logado && naTelaEntrar) router.replace("/");
  }, [pronto, logado, segments, router]);

  if (!pronto) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: CORES.lateral }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: CORES.lateral }, headerTintColor: "#fff", headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: CORES.fundo } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="entrar" options={{ headerShown: false }} />
      <Stack.Screen name="armadilha/nova" options={{ title: "Instalar armadilha" }} />
      <Stack.Screen name="armadilha/[id]" options={{ title: "Armadilha" }} />
      <Stack.Screen name="vistoria/[armadilhaId]" options={{ title: "Vistoria", presentation: "modal" }} />
      <Stack.Screen name="trincheira/nova" options={{ title: "Trincheira" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessaoProvider>
      <StatusBar style="light" />
      <Portao />
    </SessaoProvider>
  );
}
