import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { JWT } from 'googleapis-common';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const CLIENT_EMAIL = process.env.CLIENT_EMAIL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const FOLDER_ID = process.env.FOLDER_ID as string;

async function authorize() {
  const jwtClient = new google.auth.JWT(
    CLIENT_EMAIL,
    '',
    PRIVATE_KEY?.replace(/\\n/g, '\n'),
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

    return axios
      .get(object.mediaLink, {
        responseType: 'stream',
      })
      .then(async (response) => {
        const imageStream = response.data;

        await drive.files
          .create({
            media: {
              body: Readable.from(imageStream),
              mimeType: object.contentType,
            },
            fields: 'id',
            requestBody: {
              name: object.name,
              parents: [FOLDER_ID],
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
    functions.logger.warn('No media link found');
  }
}

export { authorize, uploadFile };
