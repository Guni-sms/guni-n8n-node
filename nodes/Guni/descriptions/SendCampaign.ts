import { INodeProperties } from 'n8n-workflow';

export const sendCampaignDescription: INodeProperties[] = [
	{
		displayName: 'Campaign Name',
		name: 'campaignName',
		type: 'string',
		default: '',
		required: true,
	},
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
		required: true,
	},
	{
		displayName: 'Schedule Time',
		name: 'scheduleTime',
		type: 'dateTime',
		default: '',
		description: 'Optional - when to send campaign',
	},
];
