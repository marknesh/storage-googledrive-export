# Export Storage Files to Google Drive

**Author**: Mark Munene (**[https://github.com/marknesh](https://github.com/marknesh)**)

**Description**: Exports cloud storage files to google drive in real-time.

**Details**: Use this extension to export files from your cloud storage bucket to google drive in real-time.

## Important Steps

- Create a folder in Google Drive.

**To allow existing files to be uploaded to Google drive:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **halfway complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or else you will receive a warning message `Since there is no Google account associated with this email address...`, because the service account will not yet be created.
- This allows existing files to be uploaded to Google Drive immediately after this extension installation is complete, should you choose `yes` for that option.

**To upload new files to Google drive after extension is installed:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com`

**IMPORTANT**

- If you install more than one instance of this extension, you must also share access to your folder with the new extension instance in the format `ext-storage-googledrive-export-<INSTANCE-ID>@<YOUR-PROJECT-ID>.iam.gserviceaccount.com`

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive API

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

**Configuration Parameters:**

- BUCKET_NAME: Which bucket do you want use? This field is `optional` , we will use the default bucket if left empty.

- FOLDER_PATH: Which folder do you want to listen to upload changes? e.g `photos` or to listen to multiple/sub folders e.g `photos,users` . This field is `optional` . If specified, this extension will only run when a file is uploaded in the specified folders. If you have a sub-folder within another folder and you want to monitor upload changes in both folders, make sure to **include the sub-folder** as well. The extension will not function properly if you only add the parent folder, as it will not listen to the sub-folder unless it is added.

- FOLDER_ID: The ID of the folder in google drive where you want to export your files.This can be found in the url after creating or accessing the folder e.g `https://drive.google.com/drive/u/0/folders/{FOLDER_ID}`

- FILE_TYPES: The MIME types of the files you want to upload to Google drive. The most common MIME types can be referenced [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types). This field is `optional` e.g `image/jpeg` or to allow more than one MIME type, please separate each type with a comma e.g `image/jpeg,video/mp4`

- UPLOAD_EXISTING_FILES: Do you want to upload the existing files in your storage bucket to Google drive?

- LOCATION: Where do you want to deploy the functions created for this extension?

**Cloud Functions:**

- **exportToDrive:** Storage triggered function that exports an uploaded file to google drive.
