Use this extension to export files from your cloud storage bucket to google drive in real-time.

When a file is uploaded to cloud storage, this extension uploads that file to google drive.

> [!IMPORTANT]
> **Caution:** Setting cloud functions max instances to more than one might create duplicate folders since Google Drive API takes time to reflect the latest data, hence the API might show no folders exist, when indeed a folder has already been created. For this reason, please use **only one instance**. The default is already set to 1, so no additional configuration is needed.

## Large File Uploads

For large file uploads that may exceed the Cloud Function 9-minute timeout limit, we recommend using this [cloud run job](https://github.com/marknesh/firebase-storage-to-google-drive) which supports longer execution times.

## Important Steps

- Create a folder in Google Drive.

**To allow existing files to be uploaded to Google drive:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **halfway complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or else you will receive a warning message `Since there is no Google account associated with this email address...`, because the service account will not yet be created.

- This allows existing files to be uploaded to Google Drive immediately after this extension installation is complete, should you choose `yes` for that option.

- Go to [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam)

- Add role of `Service Account User` to the extension service account `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com`

- Add role of `Cloud Tasks Enqueuer` to the firebase admin sdk service account

- Go to [tasks queue](https://console.cloud.google.com/cloudtasks/) and edit `ext-storage-googledrive-export-export-fileTask` **Max retry duration** to `520` or a value below `540` (the maximum timeout for Firebase Cloud Functions V1) but not `0`. This is the maximum amount of time for retrying a failed task measured from when the task was first attempted. This adjustment ensures that retries do not occur after the function times out, which can happen when processing files that are too large.

**To upload new files to Google drive after extension is installed:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or check [the list of your service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).

**Installation of more than one extension instance:**

- If you install more than one instance of this extension, you must also share access to your folder with the new extension instance service account email which can be found [here](https://console.cloud.google.com/iam-admin/serviceaccounts).

## Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive API

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
