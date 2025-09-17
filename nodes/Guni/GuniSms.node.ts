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
        displayName: 'Sender ID or Name or ID',
        name: 'senderId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'loadSenderIds' },
        default: '',
        placeholder: 'e.g. #SharedNum#',
        description: 'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        description: 'Choose whether to send promotional or quick SMS',
    },
    {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        placeholder: 'e.g. Hello, this is a test SMS',
        description: 'The content of the SMS message',
    },
],

	};

	methods = {
		loadOptions: {
			async loadSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;

				const response = await guniApiRequest.call(
					this as ILoadOptionsFunctions & IExecuteFunctions,
					'GET',
					'/auth/ac/sender-ids',
					{},
					{},
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
				const messageType = this.getNodeParameter('messageType', i) as string;
				const nodeMessage = this.getNodeParameter('message', i) as string;

				const json = items[i].json as any;
				const inputContacts = json.body?.contacts;

				if (!inputContacts) {
					throw new NodeOperationError(
						this.getNode(),
						`No contacts found in input data [item ${i}]`
					);
				}

				const finalContacts = Array.isArray(inputContacts)
					? inputContacts.join(',')
					: inputContacts.toString().trim();

				const incomingMessage = json.body?.message;
				const finalMessage =
					incomingMessage && incomingMessage.toString().trim().length > 0
						? incomingMessage.toString().trim()
						: nodeMessage;

				const body = {
					sender: senderId,
					message: finalMessage,
					contacts: finalContacts,
					campType: messageType,
				};

				const endpoint = '/auth/ac/send';
				const response = await guniApiRequest.call(this, 'POST', endpoint, body, {}, token);

				returnData.push({
					json: {
						success: true,
						sentTo: finalContacts,
						usedMessage: finalMessage,
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
