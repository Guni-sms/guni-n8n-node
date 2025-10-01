import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	NodeConnectionType,
	NodeOperationError,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { guniApiRequest } from './GuniApi.helper';
const FormData = require('form-data');

// === SMS Configs ===
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

function filterValidContacts(contacts: string[]): { valid: string[]; invalid: string[] } {
	const valid: string[] = [];
	const invalid: string[] = [];

	contacts.forEach((c) => {
		// Remove all non-digits (spaces, +, etc.)
		let sanitized = c.replace(/\D/g, '');

		// Remove leading "00" (international dialing prefix)
		if (sanitized.startsWith('00')) {
			sanitized = sanitized.substring(2);
		}

		// Fix cases like +6104... → should become 614...
		if (sanitized.startsWith('610')) {
			sanitized = '61' + sanitized.substring(3);
		}

		// ✅ Case 1: Already in correct international format (61XXXXXXXXX)
		if (/^61\d{9}$/.test(sanitized)) {
			valid.push(sanitized);
		}
		// ✅ Case 2: Local format with 0 (e.g. 04XXXXXXXX → 61XXXXXXXXX)
		else if (/^0?4\d{8}$/.test(sanitized)) {
			valid.push('61' + sanitized.replace(/^0/, ''));
		}
		// ✅ Case 3: Just starts with 4XXXXXXXXX → add 61
		else if (/^4\d{8}$/.test(sanitized)) {
			valid.push('61' + sanitized);
		}
		// ❌ Invalid numbers
		else {
			invalid.push(c);
		}
	});

	return { valid, invalid };
}


function getFormattedName(): string {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const min = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	const formatted = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
	return `n8n ${formatted}`;
}

function calculateSmsParts(message: string) {
	const isUnicode = /[^\x00-\x7F]/.test(message);
	const config = isUnicode ? UNICODE_GATEWAY_SMS_CONFIG : ENGLISH_GATEWAY_SMS_CONFIG;
	const matched = config.find((r) => message.length >= r.min && message.length <= r.max);
	const parts = matched ? matched.sms : 1;
	return { length: message.length, parts, encoding: isUnicode ? 'Unicode SMS' : 'GSM-7 SMS' };
}

export class Guni implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Guni SMS & MMS',
		name: 'guni',
		group: ['transform'],
		icon: 'file:guni.svg',
		version: 1,
		description: 'Send SMS or MMS via Guni API',
		defaults: { name: 'Guni' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'guniApi', required: true }],
		codex: {
			categories: ['Messaging'],
			subcategories: {
				Messaging: ['SMS', 'MMS'],
			},
			alias: ['guni', 'gunisms', 'gunimms', 'sms', 'mms', 'message', 'messaging'],
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Send SMS', value: 'sendSms', description: 'Send a text SMS', action: 'Send SMS' },
					{ name: 'Send MMS', value: 'sendMms', description: 'Send an MMS with media', action: 'Send MMS' },
				],
				default: 'sendSms',
			},
			{
				displayName: 'Sender Name or ID',
				name: 'senderId',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'loadSmsSenderIds' },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendSms'] } },
			},
			{
				displayName: 'Campaign Type',
				name: 'messageType',
				description:
					'Promotional is a campaign that is used to promote your business And Notification is a campaign that is used to notify your customers. (Opt-outs Included).',
				type: 'options',
				options: [
					{ name: 'Promotional', value: 'promotional' },
					{ name: 'Notification', value: 'notification' },
				],
				default: 'promotional',
				displayOptions: { show: { operation: ['sendSms'] } },
			},
			{
				displayName: 'Message',
				name: 'message',
				description:
					'Maximum 1224 GSM Characters are allowed in an SMS <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Know More</a>',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendSms'] } },
			},
			{
				displayName: 'Allow Unicode',
				name: 'allowUnicode',
				description:
					'Whether you want to send Unicode or not. Enable to send messages with Unicode characters. Disable to strip Unicode and send only standard text. <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Know More</a>',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['sendSms'] } },
			},
			{
				displayName: 'Sender Name or ID',
				name: 'mmsSenderId',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'loadMmsSenderIds' },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendMms'] } },
			},
			{
				displayName: 'Campaign Type',
				name: 'campaign_type',
				description:
					'Promotional is a campaign that is used to promote your business And Notification is a campaign that is used to notify your customers. (Opt-outs Included).',
				type: 'options',
				options: [
					{ name: 'Promotional', value: 'promotional' },
					{ name: 'Notification', value: 'notification' },
				],
				default: 'promotional',
				required: true,
				displayOptions: { show: { operation: ['sendMms'] } },
			},
			{
				displayName: 'Message',
				name: 'mmsMessage',
				description:
					'Maximum 1500 GSM Characters are allowed in an MMS <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Know More</a>',
				type: 'string',
				typeOptions: { rows: 5 },
				required: true,
				default: '',
				displayOptions: { show: { operation: ['sendMms'] } },
			},
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Place Your Media URL here.',
				displayOptions: { show: { operation: ['sendMms'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async loadSmsSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;
				const response = await guniApiRequest.call(
					this as unknown as IExecuteFunctions,
					'GET',
					'/auth/ac/sender-ids',
					{} as any,
					{} as any,
					token,
				);
				if (!response?.data || !Array.isArray(response.data)) return [];
				return response.data.map((s: { display: string; value: string }) => ({ name: s.display, value: s.value }));
			},

			async loadMmsSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;
				const response = await guniApiRequest.call(
					this as unknown as IExecuteFunctions,
					'GET',
					'/auth/ac/sender-ids',
					{} as any,
					{} as any,
					token,
				);
				if (!response?.data || !Array.isArray(response.data)) return [];
				return response.data
					.filter((s: { display: string }) => /shared|dedicated/i.test(s.display.toLowerCase()))
					.map((s: { display: string; value: string }) => ({ name: s.display, value: s.value }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('guniApi');
		const token = credentials.apiToken as string;

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'sendSms') {
					const senderId = this.getNodeParameter('senderId', i) as string;
					const messageType = this.getNodeParameter('messageType', i) as string;
					const allowUnicode = this.getNodeParameter('allowUnicode', i) as boolean;
					const inputJson = items[i].json as any;
					let nodeMessage =
						inputJson.message ??
						inputJson.body?.message ??
						(this.getNodeParameter('message', i) as string);

					if (!allowUnicode) nodeMessage = nodeMessage.replace(/[^\x00-\x7F]/g, '');

					const inputContacts = (items[i].json?.body as any)?.contacts;
					if (!inputContacts || !Array.isArray(inputContacts) || inputContacts.length === 0) {
						throw new NodeOperationError(this.getNode(), `No contacts found in input [item ${i}]`);
					}

					// ✅ filter valid/invalid contacts
					const { valid: finalContacts, invalid: invalidContacts } = filterValidContacts(inputContacts);
					if (finalContacts.length === 0) {
						throw new NodeOperationError(this.getNode(), `No valid contacts found [item ${i}]`);
					}

					// Sender type
					const allSendersResponse = await guniApiRequest.call(
						this,
						'GET',
						'/auth/ac/sender-ids',
						{} as any,
						{} as any,
						token,
					);
					const allSenders = Array.isArray(allSendersResponse?.data) ? allSendersResponse.data : [];
					const selectedSender = allSenders.find((s: any) => s.value === senderId);
					const senderDisplay = (selectedSender?.display || '').toLowerCase();

					let senderType = 'unknown';
					if (/personal/i.test(senderDisplay)) senderType = 'personal';
					else if (/dedicated/i.test(senderDisplay)) senderType = 'dedicated';
					else if (/shared/i.test(senderDisplay)) senderType = 'shared';
					else if (/business/i.test(senderDisplay)) senderType = 'business';

					let optout = false;
					let replyStopToOptOut = false;
					let previewMessage = nodeMessage;
					let extraLength = 0;

					if (messageType === 'promotional') {
						switch (senderType) {
							case 'shared':
							case 'dedicated':
								optout = false;
								replyStopToOptOut = true;
								if (!nodeMessage.includes('Reply STOP')) previewMessage += '   Reply STOP to optout';
								extraLength = 23;
								break;
							case 'personal':
							default:
								optout = true;
								replyStopToOptOut = false;
								if (!nodeMessage.includes('stopsms.co/u'))
									previewMessage += '  stopsms.co/u######';
								extraLength = 20;
						}
					}

					const smsInfo = calculateSmsParts(nodeMessage);
					smsInfo.length += extraLength;

					const requestBody = {
						name: getFormattedName(),
						sender: senderId,
						campaign_type: messageType,
						camp_type: 'sms',
						optout,
						replyStopToOptOut,
						contacts: finalContacts,
						unsubscribe: 0,
						totalContacts: finalContacts.length,
						message: nodeMessage,
						saved: false,
					};

					const response = await guniApiRequest.call(
						this,
						'POST',
						'/gateway/bulk?mode=Mobile',
						requestBody,
						{} as any,
						token,
					);

					returnData.push({
						json: {
							success: true,
							sentTo: finalContacts,
							invalidContacts,
							message: nodeMessage,
							messageLength: smsInfo.length,
							parts: smsInfo.parts,
							encoding: smsInfo.encoding,
							unicodeDetected: /[^\x00-\x7F]/.test(nodeMessage),
							unicodeAllowed: allowUnicode,
							selectedSenderDisplay: selectedSender?.display,
							senderType,
							previewMessage,
							response,
						},
					});
				} else if (operation === 'sendMms') {
					const senderId = this.getNodeParameter('mmsSenderId', i) as string;
					const campaign_type = this.getNodeParameter('campaign_type', i) as string;

					const json = items[i].json as any;
					const message =
						json.mmsMessage ??
						json.body?.message ??
						(this.getNodeParameter('mmsMessage', i) as string);
					const mediaUrl =
						json.mediaUrl ?? json.body?.media ?? (this.getNodeParameter('mediaUrl', i) as string);

					if (!message || !mediaUrl) {
						throw new NodeOperationError(
							this.getNode(),
							`Message or Media URL not found in input data or node parameters [item ${i}]`,
						);
					}

					const inputContacts = json.body?.contacts;
					if (!inputContacts || !Array.isArray(inputContacts) || inputContacts.length === 0) {
						throw new NodeOperationError(this.getNode(), `No contacts found in input data [item ${i}]`);
					}

					// ✅ filter valid/invalid contacts
					const { valid: finalContacts, invalid: skippedContacts } = filterValidContacts(inputContacts);
					if (finalContacts.length === 0) {
						throw new NodeOperationError(this.getNode(), `No valid contacts found [item ${i}]`);
					}

					const finalContactsStr = JSON.stringify(finalContacts);

					let previewMessage = message;
					if (campaign_type === 'promotional') {
						if (!previewMessage.includes('Reply STOP'))
							previewMessage += '  Reply STOP to opt-out';
					}

					const form = new FormData();
					form.append('media', mediaUrl);
					form.append('message', message);
					form.append('deliveredMessage', previewMessage);
					form.append('sender', senderId);
					form.append('contacts', finalContactsStr);
					form.append('name', getFormattedName());
					form.append('campaignType', campaign_type);
					form.append('replyStopToOptOut', campaign_type === 'promotional' ? 'true' : 'false');

					const requestOptions: IHttpRequestOptions = {
						method: 'POST',
						url: 'https://apit.gunisms.com.au/api/v1/gatewaymms/bulk',
						headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
						body: form,
					};

					const response = await this.helpers.httpRequest(requestOptions);

					returnData.push({
						json: {
							success: true,
							sentTo: finalContacts,
							skippedContacts,
							originalMessage: message,
							deliveredMessage: previewMessage,
							messageLength: previewMessage.length,
							media: mediaUrl,
							campaign_type,
							replyStopToOptOut: campaign_type === 'promotional',
							response,
						},
					});
				}
			} catch (error) {
				returnData.push({ json: { success: false, error: (error as Error).message } });
			}
		}

		return [returnData];
	}
}
