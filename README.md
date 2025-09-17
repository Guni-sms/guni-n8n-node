# n8n Guni SMS Node

An n8n node for sending SMS via the Guni API.

## Features

 Send promotional or notification SMS
 Dynamic sender IDs loaded from your Guni account

## Installation

Install from npm:

```
bash:
npm install n8n-nodes-guni-sms-mms
```

## Operations

The Guni SMS node supports:

Send SMS – Send messages to one or multiple phone numbers.

Choose Message Type – Select Promotional or Notification.

Dynamic Sender ID – Load sender IDs directly from your Guni account.

## Credentials

To use this node, you need a Guni API token.

Sign up for a Guni account.

Generate an API token from your Guni dashboard.

Add a new credential in n8n:

Credential Name: Guni API

API Token: Your generated token

The node automatically validates the token when saving.

## Compatibility

Minimum n8n version: 2.0.0

Tested against: 2.1.0, 2.2.0

No known version incompatibilities.

## Usage

Add the Guni SMS node to your workflow.

Select your Sender ID from your account.

Choose Message Type.

Enter your SMS content in the Message field or it will take it from previous node also.

Provide input data JSON with contacts:
```
{
  "body": {
    "contacts": ["61466644455", "61411223344"],
    "message": "Hello test"
  }
}
```

Execute the workflow to send SMS messages.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* _Link to Gunisms documentation._(https://help.gunisms.com.au/)

## Version history

v0.1.0 – Initial release. Supports sending SMS via Guni API with dynamic sender IDs and message type selection.


 