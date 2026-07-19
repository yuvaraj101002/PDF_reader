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
import { Text, useColorScheme } from 'react-native';

import { PdfExtractionHost } from '@/extraction/extraction-host';
import { APP_GRADIENT, FONT, useAppColors } from '@/ui/app-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useAppColors();
  // header matches the top stop of the screen gradient — seamless blend
  const headerColor = APP_GRADIENT[useColorScheme() === 'dark' ? 'dark' : 'light'][0];
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
          headerStyle: { backgroundColor: headerColor },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: FONT.heading, fontSize: 19 },
          headerBackTitleStyle: { fontFamily: FONT.semibold },
          contentStyle: { backgroundColor: headerColor },
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
        <Stack.Screen name="progress" options={{ title: 'My Progress' }} />
      </Stack>
      <PdfExtractionHost />
      <StatusBar style="auto" />
    </>
  );
}
