Use this extension to export files from your cloud storage bucket to google drive in real-time.

When a file is uploaded to cloud storage, this extension uploads that file to google drive.

## Before installing the extension

- Create a folder in Google Drive and **share** access to that folder with the **Extension Service Account Email**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com`

- Now you are ready to install the extension.

## Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive API

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
