import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDepartmentWriteAccess,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth.ts';
import type { UserRecord } from '../shared/types.ts';

test('scrypt password hashing and verification succeed and reject wrong passwords', () => {
  const hash = hashPassword('ClassroomDemo#2026');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(verifyPassword('ClassroomDemo#2026', hash), true);
  assert.equal(verifyPassword('WrongPassword123', hash), false);
});

test('signed session token verifies valid tokens and rejects tampering', () => {
  const token = signSessionToken(42);
  const parsed = verifySessionToken(token);
  assert.equal(parsed?.userId, 42);

  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifySessionToken(tampered), null);
});

test('department write access enforces department_staff isolation and auditor read-only', () => {
  const staffUser: UserRecord = {
    id: 2,
    name: 'Staff',
    email: 'staff@example.com',
    role: 'department_staff',
    departmentId: 3,
    isActive: true,
    isDemo: true,
    createdAt: '2026-01-01',
  };
  const auditorUser: UserRecord = {
    ...staffUser,
    id: 3,
    role: 'auditor',
    departmentId: null,
  };

  assert.equal(assertDepartmentWriteAccess(staffUser, 3).ok, true);
  assert.equal(assertDepartmentWriteAccess(staffUser, 4).ok, false);
  assert.equal(assertDepartmentWriteAccess(auditorUser, 3).ok, false);
});

test('isMysqlConfigured rejects invalid ports and identical secret placeholders, and createDataStore enforces production MySQL', async () => {
  const { createDataStore, isMysqlConfigured } = await import('./dataStore.ts');

  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  };

  try {
    process.env.MYSQL_HOST = 'ExampleSecret';
    process.env.MYSQL_PORT = 'ExampleSecret';
    process.env.MYSQL_USER = 'ExampleSecret';
    process.env.MYSQL_PASSWORD = 'ExampleSecret';
    process.env.MYSQL_DATABASE = 'ExampleSecret';
    assert.equal(isMysqlConfigured(), false);

    process.env.MYSQL_PORT = '3306';
    assert.equal(isMysqlConfigured(), false);

    process.env.MYSQL_HOST = '127.0.0.1';
    process.env.MYSQL_USER = 'govtrack_user';
    process.env.MYSQL_DATABASE = 'govtrack_ai';
    assert.equal(isMysqlConfigured(), true);

    process.env.NODE_ENV = 'development';
    process.env.MYSQL_PORT = 'not-a-port';
    const devStore = await createDataStore();
    assert.equal(devStore.mode, 'local-demo');

    process.env.NODE_ENV = 'production';
    await assert.rejects(async () => createDataStore(), /Production startup aborted/i);
  } finally {
    process.env.NODE_ENV = savedEnv.NODE_ENV;
    process.env.MYSQL_HOST = savedEnv.MYSQL_HOST;
    process.env.MYSQL_PORT = savedEnv.MYSQL_PORT;
    process.env.MYSQL_USER = savedEnv.MYSQL_USER;
    process.env.MYSQL_PASSWORD = savedEnv.MYSQL_PASSWORD;
    process.env.MYSQL_DATABASE = savedEnv.MYSQL_DATABASE;
  }
});

