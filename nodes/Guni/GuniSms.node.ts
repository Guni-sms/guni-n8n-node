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
];

function calculateSmsParts(message: string) {
	const isUnicode = /[^\x00-\x7F]/.test(message);
	const config = isUnicode ? UNICODE_GATEWAY_SMS_CONFIG : ENGLISH_GATEWAY_SMS_CONFIG;
	const matched = config.find((r) => message.length >= r.min && message.length <= r.max);
	const parts = matched ? matched.sms : 1;
	return { length: message.length, parts, encoding: isUnicode ? 'Unicode SMS' : 'GSM-7 SMS' };
}

// Extend INodeTypeDescription to include frontend
interface INodeTypeDescriptionWithFrontend extends INodeTypeDescription {
	frontend?: string;
}

export class GuniSms implements INodeType {
	description: INodeTypeDescriptionWithFrontend = {
		displayName: 'Guni SMS',
		name: 'guniSms',
		group: ['transform'],
		icon: 'file:guni.svg',
		version: 1,
		description: 'Send SMS via Guni API with templates support',
		defaults: { name: 'Guni SMS' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'guniApi', required: true }],
		properties: [
			{
				displayName: 'Sender Name or ID',
				name: 'senderId',
				type: 'options',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
				displayName: 'Template Name or ID',
				name: 'templateId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'loadTemplates' },
				default: '',
				description: 'Optional: select template to prefill message. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				placeholder: 'Message from template or previous node will appear here',
			},
			{
				displayName: 'Allow Unicode',
				name: 'allowUnicode',
				type: 'boolean',
				default: false,
				description: 'Whether to allow Unicode characters in the message',
			},
		],
		frontend: 'nodes/Guni/GuniSms.node.vue',
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
					{},
					{},
					token
				);
				if (!response?.data || !Array.isArray(response.data)) return [];
				return response.data.map((s: { display: string; value: string }) => ({
					name: s.display,
					value: JSON.stringify({ id: s.value, display: s.display }),
				}));
			},

			async loadTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;
				const response = await guniApiRequest.call(
					this as unknown as IExecuteFunctions,
					'GET',
					'/mobile/template?limit=50&sortField=createdAt&sortOrder=descend',
					{},
					{},
					token
				);
				const items = response?.data?.items;
				if (!items || !Array.isArray(items)) return [];
				const smsTemplates = items.filter((t: any) => t.mms === false);
				return smsTemplates.map((t: any) => ({
					name: t.name || t.content.slice(0, 50),
					value: t._id,
					content: t.content,
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
				const senderRaw = this.getNodeParameter('senderId', i) as string;
				const senderData = JSON.parse(senderRaw);
				const senderId = senderData.id as string;
				const senderDisplay = (senderData.display as string).toLowerCase();

				const messageType = this.getNodeParameter('messageType', i) as string;
				const allowUnicode = this.getNodeParameter('allowUnicode', i) as boolean;
				const templateId = this.getNodeParameter('templateId', i) as string;
				const nodeMessageParam = this.getNodeParameter('message', i) as string;

				const prevMessage = (items[i].json?.body as any)?.message as string | undefined;
				let nodeMessage = prevMessage || nodeMessageParam;

				// Template fallback if message empty
				if (templateId && (!prevMessage || !nodeMessageParam)) {
					const templateResponse = await guniApiRequest.call(
						this,
						'GET',
						`/mobile/template/${templateId}`,
						{},
						{},
						token
					);
					if (templateResponse?.content) nodeMessage = templateResponse.content;
				}

				if (!allowUnicode) nodeMessage = nodeMessage.replace(/[^\x00-\x7F]/g, '');

				let previewMessage = nodeMessage;
				if (messageType === 'promotional') {
					if (senderDisplay.includes('dedicated') || senderDisplay.includes('shared')) {
						previewMessage += '   Reply STOP to optout';
					} else if (senderDisplay.includes('business') || senderDisplay.includes('personal')) {
						previewMessage += '  stopsms.co/u######';
					}
				}

				const smsInfo = calculateSmsParts(previewMessage);

				const inputContacts = (items[i].json?.body as any)?.contacts;
				if (!inputContacts)
					throw new NodeOperationError(this.getNode(), `No contacts found in input [item ${i}]`);

				const finalContacts = Array.isArray(inputContacts)
					? inputContacts.join(',')
					: inputContacts.toString().trim();

				const requestBody = {
					sender: senderId,
					message: nodeMessage,
					contacts: finalContacts,
					campType: messageType,
				};

				const response = await guniApiRequest.call(this, 'POST', '/auth/ac/send', requestBody, {}, token);

				returnData.push({
					json: {
						success: true,
						sentTo: finalContacts,
						usedMessage: nodeMessage,
						previewMessage,
						messageLength: smsInfo.length,
						parts: smsInfo.parts,
						encoding: smsInfo.encoding,
						unicodeDetected: /[^\x00-\x7F]/.test(nodeMessage),
						unicodeAllowed: allowUnicode,
						response,
					},
				});
			} catch (error) {
				returnData.push({ json: { success: false, error: (error as Error).message } });
			}
		}

		return [returnData];
	}
}
