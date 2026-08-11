module.exports = {
  preset: 'jest-expo/android',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/.expo/', '/dist/'],
};
