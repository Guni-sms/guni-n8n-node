import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { GUNI_API_BASE_URL } from './constants';

/** Contexts that expose `helpers.httpRequestWithAuthentication` and `getNode`. */
export type GuniRequestContext = IExecuteFunctions | ILoadOptionsFunctions;

export interface GuniApiRequestOptions {
	/** Input item index for richer error context in execute(). */
	itemIndex?: number;
}

/**
 * Performs a JSON request against the Guni REST API.
 *
 * Authentication headers are injected automatically by n8n via the
 * `authenticate` property on the `guniApi` credential — no manual
 * token handling needed here.
 *
 * Failures are thrown as {@link NodeApiError} for correct n8n UI behavior.
 */
export async function guniApiRequest(
	this: GuniRequestContext,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	options?: GuniApiRequestOptions,
): Promise<unknown> {
	const url = `${GUNI_API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

	const requestOptions: IHttpRequestOptions = {
		method,
		url,
		headers: { 'Content-Type': 'application/json' },
		body,
		qs: query,
		json: true,
		timeout: 10000,
	};

	if (method === 'GET') {
		delete requestOptions.body;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			'guniApi',
			requestOptions,
		);
	} catch (error) {
		if (error instanceof NodeApiError || error instanceof NodeOperationError) {
			throw error;
		}
		const errorResponse: JsonObject =
			error !== null && typeof error === 'object'
				? (error as JsonObject)
				: { message: String(error) };

		throw new NodeApiError(this.getNode(), errorResponse, {
			...(options?.itemIndex !== undefined ? { itemIndex: options.itemIndex } : {}),
		});
	}
}

/**
 * Format phone numbers before sending.
 */
export function formatPhoneNumber(number: string): string {
	return number.replace(/\D/g, '');
}
