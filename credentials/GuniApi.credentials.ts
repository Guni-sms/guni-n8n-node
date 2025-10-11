import { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class GuniApi implements ICredentialType {
	name = 'guniApi';
	displayName = 'Guni API';
	documentationUrl = 'https://docs.gunisms.com.au/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Enter your Guni API token',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: 'https://api.gunisms.com.au/api/v1/auth/ac/sender-ids',
			headers: {
				'guni-token': '={{$credentials.apiToken}}',
				Authorization: 'Bearer {{$credentials.apiToken}}',
			},
		},
	};
}
