const decodeBase64 = require("atob")
const { request, GraphQLClient } = require("graphql-request")
const moment = require("moment")

const { validAuth, login_creds, api_url: url } = process.env

// using an explicit whitelist of allowed resources
// prevents any form of injection (given that we're string interpolating to make the query)
const resources = ["contact"]

const arrToObject = arr =>
  arr.reduce((obj, [key, val]) => {
    obj[key] = val
    return obj
  }, {})
const { isArray } = Array
const isObject = obj => typeof obj === "object" && !isArray(obj)

module.exports = async (ctx, req) => (ctx.res = await handle(ctx, req))

async function handle(ctx, req) {
  try {
    // using anonymous functions with hand-rolled basic auth as it was easier with my reporting tool
    // other forms of auth may work better in different cases
    const auth = decodeBase64(req.headers.authorization.replace("Basic ", ""))
    if (auth !== validAuth)
      return {
        status: 401,
        body: "Incorrect authentication."
      }

    const { idToken } = (await getToken()).userLogin.auth

    // give an overview of which resources are available if none specified
    if (!ctx.req.query.resource) return { status: 200, body: { resources } }

    return getData(ctx, idToken)
  } catch (err) {
    return {
      status: 500,
      body: "An error occurred processing your request."
    }
  }
}

async function getToken() {
  return request(
    url,
    `mutation {
      userLogin(data: {
        ${login_creds}
      }) {
        success
        auth {
          refreshToken
          idToken
        }
      }
    }`
  )
}

async function getData(ctx, idToken) {
  const { resource, since } = ctx.req.query
  if (!resources.includes(resource)) {
    return {
      status: 500,
      body: "Invalid resource."
    }
  }

  try {
    // basic date validation and then format into filter
    let filter = "" // define fallback first. Interpolating into string so "" will just have no effect
    if (since) {
      const dt = moment(since)
      if (!dt.isValid()) {
        return {
          status: 500,
          body: "Invalid date provided."
        }
      }

      filter = `(filter: {updatedAt: {gte: "${dt.format(
        "YYYY-MM-DDTHH:mm:ss"
      )}Z"}})`
    }

    const client = new GraphQLClient(url, {
      headers: { Authorization: `Bearer ${idToken}` }
    })

    // using GraphQL's introspection feature to see which fields are available
    const fields = (
      await client.request(
        `{
          table(name: "${resource}") {
            fields {
              name
              fieldType
              relation {
                refFieldIsList
              }
            }
          }
        }`
      )
    ).table.fields

    const queryFields = fields
      .map(
        ({ name, fieldType, relation }) =>
          fieldType === "FILE"
            ? `${name} { id }`
            : fieldType !== "RELATION"
            ? name
            : relation === null
            ? ""
            : relation.refFieldIsList
            ? `${name} { id }`
            : "" // don't want to fetch many side of relations
      )
      .join(" ")

    const arr = (
      await client.request(
        `query {
          ${resource}sList ${filter} {
            items {
              ${queryFields}
            }
          }
        }`
      )
    )[`${resource}sList`].items

    // for relations, drill into id (many:1)
    const output = arr.map(item =>
      arrToObject(
        Object.entries(item)
          .map(([key, val]) => [
            key,
            val === null
              ? val
              : isObject(val) // note that null has type object, which is not at all intuitive
              ? val.id
              : val
          ])
          .filter(([_key, val]) => !!val)
      )
    )

    return { status: 200, body: output }
  } catch (err) {
    console.error("Error is", err)
    return {
      status: 500,
      body: "An error occurred fetching data from 8base."
    }
  }
}
