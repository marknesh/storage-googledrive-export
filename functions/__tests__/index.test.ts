/*
 * Before testing, please create a .env file inside the integrations folder.
 * An example .env file is also in the integrations folder
 *
 */
import 'jest';
import * as functions from 'firebase-functions-test';
import { exportToDrive } from '../src/index';
import { WrappedFunction } from 'firebase-functions-test/lib/v1';
import { ObjectMetadata } from 'firebase-functions/v1/storage';
import { getStorage } from 'firebase-admin/storage';

const storage = getStorage();

const testEnv = functions();

describe('upload file to storage and export to google drive', () => {
  let wrapped: WrappedFunction<ObjectMetadata>;

  beforeAll(() => {
    wrapped = testEnv.wrap(exportToDrive) as WrappedFunction<ObjectMetadata>;
  });

  test('it should upload file to cloud storage', async () => {
    const response = await storage.bucket().upload('../../icon.png');

    expect(response[0].name).toBe('icon.png');
  });

  test('it should export a file to google drive', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      bucket: 'demo-test.appspot.com',
      name: 'icon.png',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toEqual('File uploaded successfully');
  }, 20000);
});
