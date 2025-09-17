import { INodeProperties } from 'n8n-workflow';

export const sendMmsDescription: INodeProperties[] = [
	{
		displayName: 'Sender ID',
		name: 'senderId',
		type: 'string',
		default: '',
		required: true,
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
	},
	{
		displayName: 'Media URL',
		name: 'mediaUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/image.jpg',
	},
];
