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

export class GuniMms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Guni MMS',
		name: 'guniMms',
		group: ['transform'],
		icon: 'file:guni.svg',
		version: 1,
		description: 'Send MMS via Guni API',
		defaults: { name: 'Guni MMS' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'guniApi', required: true }],
		properties: [
			{
				displayName: 'Sender ID (Shared/Dedicated) Name or ID',
				name: 'senderId',
				type: 'options',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'loadMmsSenderIds' },
				default: '',
				required: true,
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				placeholder: 'Optional subject...',

			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				placeholder: 'Optional MMS text message...',

			},
			{
				displayName: 'Attachment',
				name: 'attachment',
				type: 'string',
				default: '',
				placeholder: 'Binary property name (e.g. "data")',
				description:
					'Choose binary property from previous node (like Read Binary File). If empty, MMS will be sent without attachment.',

			},
		],
	};

	methods = {
		loadOptions: {
			// MMS sender IDs → filter only Shared / Dedicated
			async loadMmsSenderIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('guniApi');
				const token = credentials.apiToken as string;

				const response = await guniApiRequest.call(
					this as ILoadOptionsFunctions & IExecuteFunctions,
					'GET',
					'/auth/ac/sender-ids',
					{},
					{},
					token,
				);

				if (!response?.data || !Array.isArray(response.data)) return [];

				// Filter only "shared" and "dedicated"
				return response.data
					.filter((s: { display: string }) =>
						/shared|dedicated/i.test(s.display.toLowerCase()),
					)
					.map((s: { display: string; value: string }) => ({
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
				const subject = this.getNodeParameter('subject', i, '') as string;
				const message = this.getNodeParameter('message', i, '') as string;
				const attachment = this.getNodeParameter('attachment', i, '') as string;

				// 🔹 Contacts from input
				const json = items[i].json as any;
				const inputContacts = json.body?.contacts;
				if (!inputContacts) {
					throw new NodeOperationError(
						this.getNode(),
						`No contacts found in input data [item ${i}]`,
					);
				}
				const finalContacts = Array.isArray(inputContacts)
					? inputContacts.join(',')
					: inputContacts.toString().trim();

				// Base payload
				let body: any = {
					sender: senderId,
					subject,
					message,
					contacts: finalContacts,
					category: 'group',
					bucket: 'general',
					senderType: 'shared',
				};

				let requestOptions: any;

				// ✅ If attachment provided → use formData
				if (attachment) {
					const binaryData = this.helpers.assertBinaryData(i, attachment);
					const buffer = await this.helpers.getBinaryDataBuffer(i, attachment);

					requestOptions = {
						method: 'POST',
						url: 'http://localhost:4110/api/v1/gatewaymms',
						formData: {
							...body,
							media: {
								value: buffer,
								options: {
									filename: binaryData.fileName || 'file',
									contentType:
										binaryData.mimeType || 'application/octet-stream',
								},
							},
							mediaType: binaryData.mimeType,
							mediaName: binaryData.fileName,
						},
						headers: {
							'guni-token': token,
						},
					};
				} else {
					// ✅ No attachment → simple JSON
					requestOptions = {
						method: 'POST',
						url: 'http://localhost:4110/api/v1/gatewaymms',
						body,
						json: true,
						headers: {
							'guni-token': token,
						},
					};
				}

				const response = await this.helpers.httpRequest(requestOptions);

				returnData.push({
					json: {
						success: true,
						sentTo: finalContacts,
						subject,
						message,
						attachment: attachment || 'none',
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
