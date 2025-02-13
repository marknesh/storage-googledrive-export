/*
 * Before testing, please create a .env file inside the integrations folder.
 * An example .env file is also in the integrations folder
 *
 */
import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions-test';
import { WrappedFunction } from 'firebase-functions-test/lib/v1';
import { ObjectMetadata } from 'firebase-functions/v1/storage';
import 'jest';
import { exportToDrive } from '../src/index';

const storage = getStorage();

const testEnv = functions();

/* Should match FOLDER_PATH in storage-googledrive-export.env
 * Leave empty if it is not declared in storage-googledrive-export.env
 */
const FOLDER_PATH = '';

const filePath = FOLDER_PATH ? `${FOLDER_PATH}/icon.png` : 'icon.png';

describe('upload file to storage and export to google drive', () => {
  let wrapped: WrappedFunction<ObjectMetadata>;

  beforeAll(() => {
    wrapped = testEnv.wrap(exportToDrive) as WrappedFunction<ObjectMetadata>;
  });

  test('it should upload file to cloud storage', async () => {
    const response = await storage
      .bucket()
      .upload('../../icon.png', { destination: filePath });

    expect(response[0].name).toBe(filePath);
  });

  test('it should not upload a folder with no file', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      bucket: 'demo-test.appspot.com',
      name: 'folder/',
      contentType: 'image/png',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toEqual('Only folder was created');
  });

  /* Before testing file types, please add FILE_TYPES
  /* in .env with the file type you want to test*/
  test('it should only allow file types that are specified in FILE_TYPES', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      bucket: 'demo-test.appspot.com',
      name: filePath,
      /* The file type you want to test */
      contentType: 'image/png',
    };

    const response = await wrapped(objectMetadata);
    expect(response).toEqual('File uploaded successfully');
  }, 20000);

  test('it should export a file to google drive', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      bucket: 'demo-test.appspot.com',
      name: filePath,
      contentType: 'image/png',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toEqual('File uploaded successfully');
  }, 20000);

  /* Add MAXIMUM_FILE_SIZE env variable inorder to test this */
  test('Should not upload file if maximum file size limit is reached', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      bucket: 'demo-test.appspot.com',
      name: filePath,
      contentType: 'image/png',
      /* size should be greater than MAXIMUM_FILE_SIZE  */
      size: '3145728',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toContain(
      process.env.MAXIMUM_FILE_SIZE
        ? 'File size is greater than the maximum file size limit'
        : 'File uploaded successfully'
    );
  });
});
