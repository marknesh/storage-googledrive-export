import 'jest';
import * as functions from 'firebase-functions-test';
import { exportToDrive } from '../src/index';
import { WrappedFunction } from 'firebase-functions-test/lib/v1';
import { ObjectMetadata } from 'firebase-functions/v1/storage';

const testEnv = functions();

describe('export file to google drive', () => {
  let wrapped: WrappedFunction<ObjectMetadata>;

  beforeAll(() => {
    wrapped = testEnv.wrap(exportToDrive) as WrappedFunction<ObjectMetadata>;
  });

  test('it should export a file to google drive', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      mediaLink: 'https://picsum.photos/200',
      name: 'test-file.png',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toEqual('File uploaded successfully');
  }, 20000);
});
