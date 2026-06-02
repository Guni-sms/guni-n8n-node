# Changelog

## 2.2.1

### Fixed

- **Send MMS:** `messageId` and `status` in the node output now read from `data.queueResponse.addedBulk` (with `bulkId` as fallback for the id), matching the Guni API response shape and the existing SMS mapping. Previously these fields were always empty.

## 2.1.0

### Breaking

- Failures no longer return an output item with `{ success: false, error: "..." }`. Validation issues throw `NodeOperationError`; HTTP/API issues throw `NodeApiError`. Use **Continue On Fail** or error workflows if you relied on the previous behavior.

### Added

- **Item linking:** Each successful output sets `pairedItem` for the corresponding input index, preserving upstream `pairedItem` when n8n already set it ([paired items](https://docs.n8n.io/integrations/creating-nodes/build/reference/paired-items/)).
- **CI:** Added `.github/workflows/publish.yml` for npm publishing with provenance (required for verified community nodes from May 2026).

### Changed

- **Authentication:** Replaced manual API-key header injection with `httpRequestWithAuthentication` and `IAuthenticateGeneric` on the credential, satisfying the `no-http-request-with-manual-auth` scanner rule.
- **Credential:** Added `authenticate` property for automatic header injection; credential test now uses `baseURL` + relative `url`.
- **Node description:** Added `subtitle` (shows current operation on canvas), set `group: []` (was `['transform']`).
- **UX copy:** Operation actions in sentence case, boolean descriptions start with "Whether", placeholder uses `e.g.` format, descriptions aligned with n8n UX guidelines.
- **Error handling:** All Guni HTTP calls go through one helper with consistent base URL, timeout, and error handling. Unknown `operation` throws `NodeOperationError` instead of silently dropping items. Empty message after Unicode stripping throws a clear `NodeOperationError`.
- **API base URL:** Shared `nodes/Guni/constants.ts` used by the HTTP helper and credential test request.
- `loadOptions` no longer casts the request context through `IExecuteFunctions`.
