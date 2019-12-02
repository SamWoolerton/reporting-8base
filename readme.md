# Overview

Azure Function to proxy requests through to 8base (way easier for reporting tool to work with than GraphQL)

## Usage requirements

- You'll need an Azure subscription and an 8base account (should be easy enough to change to Lambda or GCF instead though)
- Recommended to use VS Code editor with Azure Functions extension as it makes life way easier, can deploy project and set environment variables with a couple of easy commands
- Also recommended to install Azure Functions CLI for local testing
- And Postman is great for testing API calls

## Usage

- Copy the `sample.local.settings.json` to `local.settings.json` and configure environment variables
- In `8base/index.js`, configure which resources you want to whitelist (just an array of strings)
- For local dev, run `func start` in the terminal from the project root (requires Azure Functions CLI)

## Debugging

- I've found a combination of console logging and using 8base's API Explorer (to see if the query was actually valid) to be pretty effective
