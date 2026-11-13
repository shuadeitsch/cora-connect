# Optional Gmail Pub/Sub push (Saturday checklist)

Replies already sync without this. The app pulls Gmail’s history API when someone opens Inbox, the Pre-planner, or a contact card, about every two minutes while the app is open and visible, and once a day on the Vercel cron. Pub/Sub push is only if you want Google to wake the CRM the moment a message arrives, even when no one has the app open.

This is optional. Skip it unless you are setting up push on Saturday.

## 1. Topic name

In the same Google Cloud project as the OAuth client, create a Pub/Sub topic, for example:

- Short name: `cora-connect-gmail-push`
- Full name: `projects/YOUR_GOOGLE_CLOUD_PROJECT_ID/topics/cora-connect-gmail-push`

`YOUR_GOOGLE_CLOUD_PROJECT_ID` is the project id of the OAuth client used for `GOOGLE_CLIENT_ID`.

## 2. Publisher grant

Grant Pub/Sub Publisher on that topic to this Google service account (it is Google’s Gmail push identity, not one of ours):

`gmail-api-push@system.gserviceaccount.com`

## 3. Push subscription URL

Create a push subscription on that topic with this endpoint:

`https://outreach-crm-brown.vercel.app/api/webhooks/gmail/push`

Use the same path on any custom domain that serves the CRM.

After the topic and subscription exist, a later change can call Gmail `users.watch` on each connected account so Google publishes to the topic. Until that is wired, this checklist only records the topic, the publisher grant, and the push URL. The history-API sync above keeps working either way.
