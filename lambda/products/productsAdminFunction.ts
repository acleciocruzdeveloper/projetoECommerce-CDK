import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB, Lambda } from "aws-sdk";
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer";
import * as AWSXRay from "aws-xray-sdk";
import { ProductType } from "aws-sdk/clients/servicecatalog";

AWSXRay.captureAWS(require("aws-sdk"))
const productsDdb = process.env.PRODUCTS_DDB!
const productEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME!
const ddbClient = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent,
    context: Context): Promise<APIGatewayProxyResult> {

    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === "/products") {
        const product = JSON.parse(event.body!) as Product
        const productCreated = await productRepository.createdProduct(product)
        const response = await sendProductEvent(
            productCreated, ProductEventType.CREATED, 
            "doctorray@develop.com.br",
            lambdaRequestId
        )
        console.log(response)
        return {
            statusCode: 201,
            body: JSON.stringify(productCreated)
        }

    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string
        if (event.httpMethod === "PUT") {
            const product = JSON.parse(event.body!) as Product
            try {
                const productUpdate = await productRepository.updateProduct(productId, product)
                const response = await sendProductEvent(
                    productUpdate, ProductEventType.UPDATE, 
                    "pabloescobar@develop.com.br",
                    lambdaRequestId
                )
                console.log(response)
                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdate)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: 'Product not found'
                }
            }

        } else if (event.httpMethod === 'DELETE') {
            console.log(`DELETE /products/${productId}`)
            try {
                const product = await productRepository.deleteProduct(productId)
                const response = await sendProductEvent(
                    product, ProductEventType.DELETE, 
                    "mariamadalena@develop.com.br",
                    lambdaRequestId
                )
                console.log(response)
                return {
                    statusCode: 204,
                    body: JSON.stringify(product)
                }
            } catch (error) {
                console.log((<Error>error).message)
                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify("Bad request")
    }
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: ProductEvent = {
        email: email,
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }
    return lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: "RequestResponse"
    }).promise()
}
