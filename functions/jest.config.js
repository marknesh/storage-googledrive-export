/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(test).[jt]s'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/__tests__/tsconfig.test.json',
    },
  },
};
