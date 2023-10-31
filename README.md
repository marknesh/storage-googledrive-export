# Export Storage Files to Google Drive

**Author**: Mark Munene (**[https://github.com/marknesh](https://github.com/marknesh)**)

**Description**: Exports cloud storage files to google drive in real-time.

**Details**: Use this extension to export files from your cloud storage bucket to google drive in real-time.

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive Api

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

**Configuration Parameters:**

- BUCKET_NAME: Which bucket do you want use? This field is `optional` , we will use the default bucket if left empty.

- FOLDER_PATH: Which folder do you want to listen to upload changes? e.g `photos` . This field is `optional` . If specified, this extension will only run when a file is uploaded in the specified folder path.

- CLIENT_EMAIL: What is the client email from your service account?

- PRIVATE_KEY: What is the private key from your service account? Please paste the private key from your service account JSON file without making any changes. e.g `-----BEGIN PRIVATE KEY-----\nPRIVATE KEY\n-----END PRIVATE KEY-----\n`

- FOLDER_ID: The ID of the folder in google drive where you want to export your files.This can be found in the url after creating or accessing the folder e.g `https://drive.google.com/drive/u/0/folders/{FOLDER_ID}`

- LOCATION: Where do you want to deploy the functions created for this extension?

**Cloud Functions:**

- **exportToDrive:** Storage triggered function that exports an uploaded file to google drive.
