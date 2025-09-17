import { INodeProperties } from 'n8n-workflow';

export const sendQuickSmsDescription: INodeProperties[] = [
	{
		displayName: 'Sender ID',
		name: 'senderId',
		type: 'string',
		default: '#SharedNum#',
		placeholder: 'e.g., MyCompany or +1234567890',
		description: 'The sender ID to be used for the message',
		displayOptions: {
			show: {
				action: ['sendQuickSms'],
			},
		},
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 5,
		},
		default: '',
		placeholder: 'The message content',
		description: 'The content of the SMS message',
		displayOptions: {
			show: {
				action: ['sendQuickSms'],
			},
		},
	},
];
