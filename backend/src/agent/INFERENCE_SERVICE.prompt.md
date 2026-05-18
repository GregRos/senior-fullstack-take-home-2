This is for some furniture that sits around the Agent and does the following:

1. Get the API key for the appropriate inference backend
2. Make sure the user has credits for the request
3. Track usage data
4. Deduct credits for the request

To compute the number of credits of a request, use some plausible formula involving the estimated input and output tokens, metrics from the agent's response, the model used, and the duration of the request.

A normal amount of credits a user can have is 100.

The number of credits a user has is stored in the DB.

# InferenceUsageEvents
The class should insert usage events to track a user's API usage.

# Model selection
The InferenceService will select the model based on user data.

# API keys
API keys are stored in a YAML file specified in $TY_API_KEYS_FILE.

Make an ApiKeyManager that will read this file. It should have `get(provider_name: Literal["openai"]): str`

# More

1. estimating tokens should not happen in the api. that's a inference service responsibility
2. install a proper package for estimating tokens. there are lots of them

# Operation field
This should be hard coded at the inference service level.

# Run invocation
let the inference service just accept the pydantic model input and serialize it on its own.
