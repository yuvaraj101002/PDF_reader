import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Link, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { PdfExtractionHost } from '@/extraction/extraction-host';
import { FONT, useAppColors } from '@/ui/app-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useAppColors();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: FONT.heading, fontSize: 19 },
          headerBackTitleStyle: { fontFamily: FONT.semibold },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'My Library',
            headerRight: () => (
              <Link href="/vocabulary" style={{ padding: 8 }}>
                <Text style={{ fontSize: 20 }}>⭐</Text>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="vocabulary" options={{ title: 'My Word Book' }} />
        <Stack.Screen name="review" options={{ title: 'Word Practice' }} />
      </Stack>
      <PdfExtractionHost />
      <StatusBar style="auto" />
    </>
  );
}
