import { ExpoRoot } from 'expo-router';

// Expo Router entry point
export default function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}
