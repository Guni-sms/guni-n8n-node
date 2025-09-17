import { IExecuteFunctions, IDataObject } from 'n8n-workflow';

/**
 * Makes a request to the Gunisms API using n8n helpers
 */
export async function guniApiRequest(
	this: IExecuteFunctions,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	apiKey: string,
): Promise<any> {
	const url = `https://apit.gunisms.com.au/api/v1${endpoint}`;

	const options = {
		method,
		url,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'guni-token': apiKey,
		},
		body,
		qs: query,
		json: true,
		timeout: 10000,
	};

	try {
		return await this.helpers.request!(options);
	} catch (error: any) {
		// Just throw a normal Error with API message
		const message =
			error.response?.body?.message || error.response?.body || error.message || 'Unknown API error';
		throw new Error(`Guni API Request Failed: ${message}`);
	}
}

/**
 * Format phone numbers before sending
 */
export function formatPhoneNumber(number: string): string {
	return number.replace(/\D/g, '');
}
