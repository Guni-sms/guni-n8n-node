import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { guniApiRequest } from './GuniApi.helper';

const ENGLISH_GATEWAY_SMS_CONFIG = [
	{ min: 1, max: 160, sms: 1 },
	{ min: 161, max: 306, sms: 2 },
	{ min: 307, max: 459, sms: 3 },
	{ min: 460, max: 612, sms: 4 },
	{ min: 613, max: 765, sms: 5 },
	{ min: 766, max: 918, sms: 6 },
	{ min: 919, max: 1071, sms: 7 },
	{ min: 1072, max: 1224, sms: 8 },
];

const UNICODE_GATEWAY_SMS_CONFIG = [
	{ min: 1, max: 70, sms: 1 },
	{ min: 71, max: 134, sms: 2 },
	{ min: 135, max: 201, sms: 3 },
	{ min: 202, max: 268, sms: 4 },
	{ min: 269, max: 335, sms: 5 },
	{ min: 336, max: 402, sms: 6 },
	{ min: 403, max: 469, sms: 7 },
	{ min: 470, max: 536, sms: 8 },
	{ min: 537, max: 605, sms: 9 },
	{ min: 606, max: 672, sms: 10 },
	{ min: 673, max: 739, sms: 11 },
	{ min: 740, max: 796, sms: 12 },
	{ min: 797, max: 851, sms: 13 },
];

function calculateSmsParts(message: string) {
	const isUnicode = /[^\x00-\x7F]/.test(message);
	const config = isUnicode ? UNICODE_GATEWAY_SMS_CONFIG : ENGLISH_GATEWAY_SMS_CONFIG;
	const matched = config.find((r) => message.length >= r.min && message.length <= r.max);
	const parts = matched ? matched.sms : 1;
	return { length: message.length, parts, encoding: isUnicode ? 'Unicode SMS' : 'GSM-7 SMS' };
}

export class GuniSms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Guni SMS',
		name: 'guniSms',
		group: ['transform'],
		icon: 'file:guni.svg',
		version: 1,
		description: 'Send SMS via Guni API',
		defaults: { name: 'Guni SMS' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'guniApi', required: true }],
		properties: [
			{
				displayName: 'Sender Name or ID',
				name: 'senderId',
				type: 'options',
				description: 'Choose a sender ID. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'loadSenderIds' },
				default: '',
				required: true,
			},
			{
				displayName: 'Message Type',
				name: 'messageType',
				type: 'options',
				options: [
					{ name: 'Promotional', value: 'promotional' },
					{ name: 'Notification', value: 'notification' },
				],
				default: 'notification',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				placeholder: 'Enter your message',
				required: true,
			},
			{
				displayName: 'Allow Unicode',
				name: 'allowUnicode',
				type: 'boolean',
				default: false,
				description: 'Whether to allow Unicode characters in the message',
			},
		],
	};

	methods = {
		loadOptions: {
			async loadSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;

				const response = await guniApiRequest.call(
					this as unknown as IExecuteFunctions,
					'GET',
					'/auth/ac/sender-ids',
					{} as any,
					{} as any,
					token
				);

				if (!response?.data || !Array.isArray(response.data)) return [];

				return response.data.map((s: { display: string; value: string }) => ({
					name: s.display,
					value: s.value,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('guniApi');
		const token = credentials.apiToken as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const senderId = this.getNodeParameter('senderId', i) as string;
				if (!senderId) {
					throw new NodeOperationError(this.getNode(), `Sender ID is required for item ${i}`);
				}

				const messageType = this.getNodeParameter('messageType', i) as string;
				const allowUnicode = this.getNodeParameter('allowUnicode', i) as boolean;
				const nodeMessageParam = this.getNodeParameter('message', i) as string;

				const prevMessage = (items[i].json?.body as any)?.message as string | undefined;
				let nodeMessage = prevMessage || nodeMessageParam;

				if (!allowUnicode) nodeMessage = nodeMessage.replace(/[^\x00-\x7F]/g, '');

				// Determine optout, replyStopToOptOut & previewMessage
				let optout = false;
				let replyStopToOptOut = false;
				let previewMessage = nodeMessage;
				let extraLength = 0;

				if (messageType === 'promotional') {
					if (senderId.startsWith('#') || senderId.toLowerCase().includes('shared')) { // Shared number
						optout = false;
						replyStopToOptOut = true;
						if (!nodeMessage.includes('Reply STOP')) 
						previewMessage += '   Reply STOP to optout';
						extraLength = 23;
					} else if (/^\d+$/.test(senderId)) { // Numeric number
						if (senderId.startsWith('6')) { // Personal number
							optout = true;
							replyStopToOptOut = false;
							if (!nodeMessage.includes('stopsms.co/u'))
							previewMessage += '  stopsms.co/u######';
							extraLength = 20;
						} else if (senderId.startsWith('4')) { // Dedicated number
							optout = false;
							replyStopToOptOut = true;
							if (!nodeMessage.includes('Reply STOP')) 
							previewMessage += '   Reply STOP to optout';
							extraLength = 23;
						} else { // fallback
							optout = true;
							replyStopToOptOut = false;
							if (!nodeMessage.includes('stopsms.co/u')) 
							previewMessage += '  stopsms.co/u######';
							extraLength = 20;
						}
					} else { // Business / text
						optout = true;
						replyStopToOptOut = false;
						if (!nodeMessage.includes('stopsms.co/u')) nodeMessage += '  stopsms.co/u######';
						previewMessage += '  stopsms.co/u######';
						extraLength = 20;
					}
				}

				const inputContacts = (items[i].json?.body as any)?.contacts;
				if (!inputContacts || !Array.isArray(inputContacts) || inputContacts.length === 0) {
					throw new NodeOperationError(this.getNode(), `No contacts found in input [item ${i}]`);
				}

				const smsInfo = calculateSmsParts(nodeMessage);
				smsInfo.length += extraLength; // Add opt-out text length to total
				smsInfo.parts = calculateSmsParts(nodeMessage).parts;

				const requestBody = {
					name: `Campaign ${new Date().toLocaleString()}`,
					sender: senderId,
					campaign_type: messageType,
					camp_type: 'sms',
					optout,
					replyStopToOptOut,
					contacts: inputContacts,
					unsubscribe: 0,
					totalContacts: inputContacts.length,
					message: nodeMessage,
					saved: false,
				};

				console.log('GuniSMS Payload:', JSON.stringify(requestBody, null, 2));

				const response = await guniApiRequest.call(
					this,
					'POST',
					'/gateway/bulk?mode=Mobile',
					requestBody,
					{} as any,
					token
				);

				returnData.push({
					json: {
						success: true,
						sentTo: inputContacts,
						previewMessage,
						message: nodeMessage,
						messageLength: smsInfo.length,
						parts: smsInfo.parts,
						encoding: smsInfo.encoding,
						unicodeDetected: /[^\x00-\x7F]/.test(nodeMessage),
						unicodeAllowed: allowUnicode,
						response,
					},
				});
			} catch (error) {
				returnData.push({
					json: {
						success: false,
						error: (error as Error).message,
					},
				});
			}
		}

		return [returnData];
	}
}
