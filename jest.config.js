module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
    'react-native|@react-native|' +
    'expo|@expo|expo-modules-core|' +
    '@supabase|@react-native-async-storage' +
    ')/)',
  ],
};
