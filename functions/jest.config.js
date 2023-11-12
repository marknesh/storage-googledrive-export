/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(test).js"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
};
