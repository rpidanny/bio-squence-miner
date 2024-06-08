import { defaults } from 'jest-config'
import type { JestConfigWithTsJest } from 'ts-jest'

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: defaults.testRegex,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/test/tsconfig.json',
      },
    ],
  },
  testEnvironment: 'jest-environment-node',
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/tmp/',
    '<rootDir>/node_modules/',
    '<rootDir>/local_tests/',
    '<rootDir>/test/fixtures/',
  ],
  testTimeout: 20_000,
  setupFiles: ['<rootDir>/test/setup.ts'],
  // collectCoverageFrom: ['**/*.(t|j)s'],
  // collectCoverageFrom: ['<rootDir>/src/**/*.(t|j)s'],
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [['lcov', { projectRoot: './' }], 'text'],
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/test/',
    '<rootDir>/dist/',
    '<rootDir>/tmp/',
    '<rootDir>/local_tests/',
    '<rootDir>/coverage/',
    '<rootDir>/src/commands/',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 84,
      functions: 88,
      lines: 88,
    },
  },
}

export default config
