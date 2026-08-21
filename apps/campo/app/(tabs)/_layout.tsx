import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { CORES } from "../../src/config";

function Icone({ simbolo, color }: { simbolo: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{simbolo}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: CORES.lateral },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: CORES.marca,
        tabBarInactiveTintColor: CORES.textoSuave,
        tabBarStyle: { backgroundColor: CORES.superficie, borderTopColor: CORES.borda, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        sceneStyle: { backgroundColor: CORES.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Armadilhas", tabBarIcon: ({ color }) => <Icone simbolo="◎" color={color} /> }} />
      <Tabs.Screen name="mapa" options={{ title: "Mapa", tabBarIcon: ({ color }) => <Icone simbolo="▣" color={color} /> }} />
      <Tabs.Screen name="sync" options={{ title: "Sincronizar", tabBarIcon: ({ color }) => <Icone simbolo="⇅" color={color} /> }} />
    </Tabs>
  );
}
