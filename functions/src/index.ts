import * as functions from 'firebase-functions';
import * as process from 'process';
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { JWT } from 'googleapis-common';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function authorize() {
  const jwtClient = new google.auth.JWT(
    process.env.CLIENT_EMAIL,
    '',
    process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    SCOPES
  );
  await jwtClient.authorize();
  return jwtClient;
}

async function uploadFile(
  authClient: JWT,
  object: functions.storage.ObjectMetadata
) {
  if (object.mediaLink) {
    const drive = google.drive({ version: 'v3', auth: authClient });

    const folderId = process.env.FOLDER_ID as string;

    await axios
      .get(object.mediaLink, {
        responseType: 'stream',
      })
      .then(async (response) => {
        const imageStream = response.data;

        return await drive.files
          .create({
            media: {
              body: Readable.from(imageStream),
            },
            fields: 'id',
            requestBody: {
              name: object.name,
              parents: [folderId],
            },
          })
          .then((res) =>
            functions.logger.info(
              `File uploaded successfully with id ${res.data.id}`
            )
          )
          .catch((error) => functions.logger.warn(error.message));
      })
      .catch((error) => functions.logger.warn(error.message));
  } else {
    throw new Error('No media link found');
  }
}

exports.exportToDrive = functions.storage.object().onFinalize((object) => {
  return authorize()
    .then((authClient) => uploadFile(authClient, object))
    .catch((error) => {
      return functions.logger.warn(error.message);
    });
});
