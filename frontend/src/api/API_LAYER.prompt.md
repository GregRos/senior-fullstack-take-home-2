serves as a hub for making requests to the server.

1. All fetches should happen here.
2. Don't expose arbitrary `get` to the rest of the app.
3. All callers should call specific methods to fetch the data, e.g. `getJournalEntry`
4. Each method body should send a request with a specific method, uri, and body shape.

Initialized with a base URI at runtime.

Before API requests it should `GET /api/login` once. This doesn't need the authorization header and does the same thing as `/api/me`. This returns the user info such as the user ID which can be used in the auth header.

1. Centralize handling of requests like URI construction in a single request method that receives a URL, method, and body.
2. All requests and responses will always be application/json
3. No requests will be aborted

# Implement as provider/context

Implement as a provider with `<ApiProvider baseUrl={...}>`

In callers add `useApi()`.
