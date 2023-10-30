import 'jest';
import * as functions from 'firebase-functions-test';
import { exportToDrive } from '../src/index';

const testEnv = functions();

describe('export file to google drive', () => {
  let wrapped: any;

  beforeAll(() => {
    wrapped = testEnv.wrap(exportToDrive);
  });

  test('it should export a file to google drive', async () => {
    const objectMetadata = {
      ...testEnv.storage.exampleObjectMetadata(),
      mediaLink: 'https://picsum.photos/200',
      name: 'test-file.png',
    };

    const response = await wrapped(objectMetadata);

    expect(response).toEqual('File uploaded successfully');
  }, 10000);
});
