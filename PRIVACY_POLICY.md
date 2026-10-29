# Privacy Policy

**Neurix**: last updated October 30, 2026

## Overview

Neurix is an offline AI chat application. Your privacy is our core design principle — all AI processing happens on your device, and no personal data is collected, stored on servers, or shared with third parties.

## Data Collection

**Neurix does not collect any personal data.**

- No account creation required
- No email, name, or personal information collected
- No analytics or tracking
- No telemetry or crash reporting
- No advertising or ad tracking

## Data Storage

All data is stored locally on your device:

- **Chat conversations** — Stored in the app's private storage on your device. Only you can access them.
- **Downloaded AI models** — Stored in the app's local data directory on your device.
- **App settings** — Preferences like temperature, system prompt, etc. are stored locally.
- **Connectors** — The list of sources you connected, and the text of documents you picked on a phone, are stored in the app's local storage. A Gmail app password is kept in memory only and is never written to disk.

No data is stored on any external server.

## Network Usage

Neurix connects to the internet only for:

- **Downloading AI models** — Models are downloaded from HuggingFace (huggingface.co), a public model hosting service. Only the model files are downloaded. No personal data is sent.
- **Connectors you choose to use** — Only if you connect them, and only to read:
  - **GitHub**: the public repositories you add are read from api.github.com (description, README, open issues and pull requests). No account or token is used.
  - **Gmail**: your newest emails are read from imap.gmail.com with the address and app password you enter, in read-only mode, so nothing is marked as read, sent or deleted.

What a connector reads is used on your device as context for your question. It is not sent anywhere else.

After a model is downloaded, Neurix works entirely offline. No internet connection is required to use the AI chat features unless you turn on a GitHub or Gmail connector.

## Third-Party Services

- **HuggingFace** — Used solely for downloading open-source AI model files. Neurix does not send any personal data to HuggingFace. Their privacy policy is available at https://huggingface.co/privacy

- **GitHub and Google (Gmail)** — Contacted only when you connect them as described above, and only from your device. Their privacy policies are at https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement and https://policies.google.com/privacy

No other third-party services are used.

## AI Processing

All AI inference (the process of generating responses) runs entirely on your device's hardware. Your conversations are never sent to any server. The AI models run locally using your phone's CPU.

## Data Deletion

You can delete your data at any time:

- **Chat history** — Delete individual conversations or clear all history from Settings
- **Downloaded models** — Delete from the My Models screen
- **All app data** — Uninstalling the app removes all data

## Children's Privacy

Neurix does not knowingly collect information from children under 13. The app does not require any personal information to use.

## Changes to This Policy

If we update this privacy policy, the changes will be posted here with an updated date. The app itself does not collect data, so changes would be minimal.

## Contact

If you have questions about this privacy policy:

- GitHub: https://github.com/Razee4315/neurix
- Developer: Saqlain Abbas
