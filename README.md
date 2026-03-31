# n8n-nodes-guni

A community node for [n8n](https://n8n.io/) that lets you send SMS and MMS via the [Guni API](https://docs.gunisms.com.au/api).

## Features

- Send promotional or notification **SMS**
- Send promotional or notification **MMS** (with media URL)
- Dynamic sender ID selection from your Guni account

## Installation

Install from npm (self-hosted n8n):

```bash
npm install n8n-nodes-guni
```

Or search for **Guni SMS & MMS** in the n8n community nodes panel.

## Credentials

To use this node you need a Guni API token.

1. [Sign up](https://app.gunisms.com.au/signup) for a Guni account (if you don't have one).
2. [Generate an API token](https://help.gunisms.com.au/kb/how-to-generate-api-token/) from your Guni dashboard.
3. In n8n, add a new **Guni API** credential and paste your token.

The node validates the token automatically when you save the credential.

Want to send using your business name? [Set up a sender ID](https://help.gunisms.com.au/kb/set-sender-id/).

## Operations

### SMS

- **Send SMS** — Send text messages to one or multiple phone numbers.
  - Campaign type: Promotional or Notification.
  - Sender ID: Choose from your account's sender IDs.
  - Unicode support: Optionally allow Unicode characters.

### MMS

- **Send MMS** — Send multimedia messages with a media URL.
  - Campaign type: Promotional or Notification.
  - Sender ID: Choose from your account's sender IDs.

## Usage

1. Add the **Guni SMS & MMS** node to your workflow.
2. Select the operation (Send SMS or Send MMS).
3. Choose your Sender ID.
4. Choose the Campaign Type.
5. Enter your message text (or pass it from a previous node).
6. For MMS, also provide a Media URL.
7. Provide input data with contacts:

**SMS example:**

```json
{
  "contacts": ["61439554019", "61439543139"],
  "message": "Hello, this is a test SMS"
}
```

**MMS example:**

```json
{
  "contacts": ["61439543031", "61439551969"],
  "message": "Hello, this is a test MMS",
  "media": "https://example.com/image.png"
}
```

8. Execute the workflow.

## Compatibility

- Minimum n8n version: 1.0.0
- Tested with n8n 1.x and 2.x

## Upgrading to 3.x (breaking changes)

- **Failed sends are real errors:** API and validation failures now **fail the node** (with `NodeApiError` / `NodeOperationError`) instead of returning an output item with `success: false`. Use n8n's **Continue On Fail** (node settings) or an **Error Workflow** if you need the old "soft failure" behavior.
- **Item linking:** Successful outputs include `pairedItem` so downstream nodes and expressions resolve the correct input item.
- **Authentication:** The node now uses `httpRequestWithAuthentication` with the `IAuthenticateGeneric` credential pattern, aligning with n8n best practices.

## Version history

- **3.1.0** — Use `httpRequestWithAuthentication` (n8n-standard auth); add `subtitle`, `authenticate` on credential, `group: []`; UX copy aligned with n8n guidelines; GitHub Actions publish workflow with provenance.
- **3.0.1** — Propagate upstream `pairedItem`; reject unknown operations and empty post-strip SMS; single `GUNI_API_BASE_URL` constant.
- **3.0.0** — `pairedItem` on outputs, API errors via `NodeApiError`, validation via `NodeOperationError`. MMS uses same helper as SMS.
- **2.x** — Prior stable line.
- **1.0.2** — Initial release.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Guni API documentation](https://docs.gunisms.com.au/api)
- [Guni help center](https://help.gunisms.com.au/)

## License

[MIT](LICENSE)
