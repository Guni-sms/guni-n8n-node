import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
import { GUNI_API_BASE_URL } from '../nodes/Guni/constants';

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
			description: 'The API token from your Guni dashboard.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
				'guni-token': '={{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: GUNI_API_BASE_URL,
			url: '/auth/ac/sender-ids',
		},
	};
}
