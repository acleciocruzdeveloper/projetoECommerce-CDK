import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent,
    context: Context): Promise<APIGatewayProxyResult> {

    const lambdaRequestId = context.awsRequestId; //identificacao que entra pelo gateway
    const apiRequestId = event.requestContext.requestId; //
    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)
    const httpMethod = event.httpMethod

    if (event.resource === "/products") {
        if (httpMethod === 'GET') {
            const product = await productRepository.getAllProducts()
            return {
                statusCode: 200,
                body: JSON.stringify(product)
            }
        }
    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string
        try {
            const product = await productRepository.getProductId(productId)
            return {
                statusCode: 200,
                body: JSON.stringify(product)
            }
        } catch (error) {
            console.log((<Error>error).message)
            return {
                statusCode: 404,
                body: ((<Error>error).message)
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Bad Request"
        })
    }

}