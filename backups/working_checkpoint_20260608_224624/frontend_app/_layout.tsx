import { Slot } from 'expo-router';

// Bypass expo-router temporarily due to LinkingContext issue
export default function RootLayout() {
  return <Slot />;
}