import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';
import { guniApiRequest } from './GuniApi.helper';

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

/** Expected `items[].json` shape for SMS/MMS (expressions may add other keys). */
interface GuniItemBody {
	contacts?: unknown;
	message?: string;
	media?: string;
}

interface GuniItemJson extends IDataObject {
	message?: string;
	mmsMessage?: string;
	mediaUrl?: string;
	body?: GuniItemBody;
}

/**
 * Preserve upstream [item linking](https://docs.n8n.io/integrations/creating-nodes/build/reference/paired-items/) when n8n already set `pairedItem`.
 */
function resolvePairedItem(
	item: INodeExecutionData,
	itemIndex: number,
): NonNullable<INodeExecutionData['pairedItem']> {
	if (item.pairedItem === undefined) {
		return { item: itemIndex };
	}
	return item.pairedItem;
}

export class Guni implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Guni SMS & MMS',
		name: 'guni',
		subtitle: '={{$parameter["operation"]}}',
		group: [],
		icon: 'file:guni.svg',
		version: 1,
		description: 'Send SMS or MMS via Guni API',
		defaults: { name: 'Guni' },
		inputs: ['main'],
		outputs: ['main'],
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
				{
					name: 'Send SMS',
					value: 'sendSms',
					description: 'Send a text message via SMS',
					action: 'Send a SMS',
				},
				{
					name: 'Send MMS',
					value: 'sendMms',
					description: 'Send a multimedia message via MMS',
					action: 'Send a MMS',
				},
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
				'Promotional campaigns promote your business. Notification campaigns notify your customers (opt-outs included).',
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
				'The text content of the SMS. Maximum 1224 GSM characters. <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Learn more</a>.',
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
				'Whether to allow Unicode characters in the message. When disabled, Unicode characters are stripped and only standard GSM text is sent. <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Learn more</a>.',
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
				'Promotional campaigns promote your business. Notification campaigns notify your customers (opt-outs included).',
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
				'The text content of the MMS. Maximum 1500 GSM characters. <a href="https://help.gunisms.com.au/kb/how-many-characters-can-i-send-in-an-sms/">Learn more</a>.',
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
			description: 'URL of the media file to include in the MMS',
			placeholder: 'e.g. https://example.com/image.png',
			displayOptions: { show: { operation: ['sendMms'] } },
		},
		],
	};

	methods = {
		loadOptions: {
			async loadSmsSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = (await guniApiRequest.call(
					this,
					'GET',
					'/auth/ac/sender-ids',
				)) as IDataObject;
				if (!response?.data || !Array.isArray(response.data)) return [];
				const rows = response.data as Array<{ display: string; value: string }>;
				return rows.map((s) => ({
					name: s.display,
					value: s.value,
				}));
			},

			async loadMmsSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = (await guniApiRequest.call(
					this,
					'GET',
					'/auth/ac/sender-ids',
				)) as IDataObject;
				if (!response?.data || !Array.isArray(response.data)) return [];
				const rows = response.data as Array<{ display: string; value: string }>;
				return rows
					.filter((s) => /shared|dedicated/i.test(s.display.toLowerCase()))
					.map((s) => ({ name: s.display, value: s.value }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			const pairedItem = resolvePairedItem(items[i], i);

			if (operation === 'sendSms') {
				const senderId = this.getNodeParameter('senderId', i) as string;
				const messageType = this.getNodeParameter('messageType', i) as string;
				const allowUnicode = this.getNodeParameter('allowUnicode', i) as boolean;
				const inputJson = items[i].json as GuniItemJson;
				let nodeMessage =
					inputJson.message ??
					inputJson.body?.message ??
					(this.getNodeParameter('message', i) as string);

				if (typeof nodeMessage !== 'string') {
					nodeMessage = nodeMessage == null ? '' : String(nodeMessage);
				}
				if (!allowUnicode) nodeMessage = nodeMessage.replace(/[^\x00-\x7F]/g, '');

				if (!nodeMessage.trim()) {
					throw new NodeOperationError(
						this.getNode(),
						'Message is empty after resolving input and Unicode handling. Enable "Allow Unicode" or provide GSM text.',
						{ itemIndex: i },
					);
				}

				const inputContacts = inputJson.body?.contacts;
				if (!inputContacts || !Array.isArray(inputContacts) || inputContacts.length === 0) {
					throw new NodeOperationError(this.getNode(), `No contacts found in input [item ${i}]`, {
						itemIndex: i,
					});
				}

				// ✅ filter valid/invalid contacts
				const { valid: finalContacts, invalid: invalidContacts } =
					filterValidContacts(inputContacts);
				if (finalContacts.length === 0) {
					throw new NodeOperationError(this.getNode(), `No valid contacts found [item ${i}]`, {
						itemIndex: i,
					});
				}

				// Sender type
				const allSendersResponse = (await guniApiRequest.call(
					this,
					'GET',
					'/auth/ac/sender-ids',
					{} as IDataObject,
					{} as IDataObject,
					{ itemIndex: i },
				)) as IDataObject;
				const allSenders = Array.isArray(allSendersResponse?.data)
					? (allSendersResponse.data as IDataObject[])
					: [];
				const selectedSender = allSenders.find((s) => s.value === senderId);
				const senderDisplay = String(selectedSender?.display ?? '').toLowerCase();

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
							if (!nodeMessage.includes('stopsms.co/u')) previewMessage += '  stopsms.co/u######';
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
					requestBody as unknown as IDataObject,
					{} as IDataObject,
					{ itemIndex: i },
				);

			const apiResponse = response as IDataObject;
			const apiData = apiResponse?.data as IDataObject | undefined;
			const addedBulk = (apiData?.queueResponse as IDataObject)?.addedBulk as IDataObject | undefined;

			returnData.push({
				json: {
					success: true,
					messageId: addedBulk?._id ?? '',
					status: addedBulk?.status ?? '',
					sentTo: finalContacts,
					invalidContacts,
					message: nodeMessage,
					parts: smsInfo.parts,
					encoding: smsInfo.encoding,
					campaignType: messageType,
					senderType,
				},
				pairedItem,
			});
			} else if (operation === 'sendMms') {
				const senderId = this.getNodeParameter('mmsSenderId', i) as string;
				const campaign_type = this.getNodeParameter('campaign_type', i) as string;

				const json = items[i].json as GuniItemJson;
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
						{ itemIndex: i },
					);
				}

				const inputContacts = json.body?.contacts;
				if (!inputContacts || !Array.isArray(inputContacts) || inputContacts.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						`No contacts found in input data [item ${i}]`,
						{ itemIndex: i },
					);
				}

				// ✅ filter valid/invalid contacts
				const { valid: finalContacts, invalid: skippedContacts } =
					filterValidContacts(inputContacts);
				if (finalContacts.length === 0) {
					throw new NodeOperationError(this.getNode(), `No valid contacts found [item ${i}]`, {
						itemIndex: i,
					});
				}

				const finalContactsStr = JSON.stringify(finalContacts);

				let previewMessage = message;
				if (campaign_type === 'promotional') {
					if (!previewMessage.includes('Reply STOP')) previewMessage += '  Reply STOP to opt-out';
				}

				const mmsBody: IDataObject = {
					media: mediaUrl,
					message,
					deliveredMessage: previewMessage,
					sender: senderId,
					contacts: finalContactsStr,
					name: getFormattedName(),
					campaignType: campaign_type,
					replyStopToOptOut: campaign_type === 'promotional' ? 'true' : 'false',
				};

				const response = await guniApiRequest.call(
					this,
					'POST',
					'/gatewaymms/bulk',
					mmsBody,
					{} as IDataObject,
					{ itemIndex: i },
				);

			const apiResponse = response as IDataObject;
			const apiData = apiResponse?.data as IDataObject | undefined;

			returnData.push({
				json: {
					success: true,
					messageId: (apiData as IDataObject)?._id ?? '',
					status: (apiData as IDataObject)?.status ?? '',
					sentTo: finalContacts,
					skippedContacts,
					message,
					media: mediaUrl,
					campaignType: campaign_type,
				},
				pairedItem,
			});
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Unknown operation: "${operation}". Expected sendSms or sendMms.`,
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
}
