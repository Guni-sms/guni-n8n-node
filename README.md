# n8n Guni SMS Node

An n8n node for sending SMS And MMS via the Guni API.

## Features

 Send promotional or notification SMS

 Send promotional or notification MMS
 
 Dynamic sender IDs loaded from your Guni account

## Installation

Install from npm:

```
bash:
npm install n8n-nodes-guni-sms-mms
```

## Operations

The Guni SMS node supports:

SMS

Send SMS – Send messages to one or multiple phone numbers.

Choose Message Type – Select Promotional or Notification.

Sender ID – Select Sender ID from Your Sender Id list in Node.

MMS

Send MMS – Send multimedia messages with a media URL.

Campaign Type – Select Promotional or Notification.

Sender ID – Select Sender ID from Your Sender Id list in Node.


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

Add the Guni SMS or Guni MMS node to your workflow.

Select your Sender ID from your account.

Choose Message Type.

Enter your SMS or MMS content in the Message field or it will take it from previous node also.

Also Enter URL in case of MMS.

Provide input data JSON with contacts :
```
{
  "body": {
    "contacts": ["61466644455", "61411223344"],
    "message": "Hello test SMS"
  }
}
```

```
{
  "body": {
    "contacts": ["61466644455", "61411223344"],
    "message": "Hello test MMS"
     "media": "https://example.com/myImage.jpg",
  }
}
```

Execute the workflow to send SMS or MMS.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Gunisms help](https://help.gunisms.com.au/)

## Version history

v0.1.0 – Initial release. Supports sending SMS And MMS via Guni API with dynamic sender IDs and message type selection.


 