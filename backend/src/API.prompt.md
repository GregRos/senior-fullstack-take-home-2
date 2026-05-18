# middleware
Will be accompanied by an Authorization header that just contains the user id. Query it against the data layer and embed the user in the state. Do this in a middleware. Expose the `user` to endpoints. The endpoints will use that for calls to the data layer.

The middleware and fast api setup should happen in [server.py](./server.py).
# Requests

Define http endpoints using fast api and hook them up to the data layer and inference service. This should happen in [api.py](./api.py).

Use the types from the data layer for CRUD and the types from the inference service/agent for the mistakes endpoint.

```yaml
GET /api/me: gets current user info
GET /api/entry/$ID: gets journal entry JSON by ID
PATCH /api/entry/$ID: updates a journal entry
DELETE /api/entry/$ID: deletes a journal entry
GET /api/stats: gets a mistakes summary over time by going over the mistakes table
POST /api/entry/$ID/mistakes: |
    checks a paragraph for mistakes with a body containing the input to the model and attaches mistakes to the relevant table for that entry
```

DO NOT DEFINE OTHER ENDPOINTS BECAUSE YOU FEEL LIKE IT

DO NOT MODIFY ANY CODE OUTSIDE OF THE SPECIFIED AREAS

# Dummy login route
Add a special `/api/login` route. This route should not use the authorization check middleware. It should return the info for the default user.
