import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as ssm from "aws-cdk-lib/aws-ssm"

import * as cdk from "aws-cdk-lib"

import { Construct } from "constructs"

interface ProductsAppStackProps extends cdk.StackProps {
    eventsDdb: dynamodb.Table

}

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodJS.NodejsFunction
    readonly productsAdminHandler: lambdaNodJS.NodejsFunction
    readonly productsDdb: dynamodb.Table

    constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
        super(scope, id, props)

        this.productsDdb = new dynamodb.Table(this, "'ProductsDdb'", {
            tableName: "products",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        // Products Layers
        const productsLayersArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayersVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayersVersionArn", productsLayersArn)

        // Product Events Layers
        const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, "ProductsEventsLayerVersionArn")
        const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsEventsLayerVersionArn", productEventsLayerArn)

        const productsEventsHandler = new lambdaNodJS.NodejsFunction(
            this, "ProductsEventsFunction", {
            functionName: "ProductsEventsFunction",
            entry: "lambda/products/productsEventsFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        props.eventsDdb.grantWriteData(productsEventsHandler)

        this.productsFetchHandler = new lambdaNodJS.NodejsFunction(this,
            "ProductsFetchFunction", {
            runtime: lambda.Runtime.NODEJS_16_X,
            functionName: "ProductsFecthFunction",
            entry: "lambda/products/productsFetchFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName
            },
            layers: [productsLayer],
            tracing: lambda.Tracing.ACTIVE
        })

        this.productsDdb.grantReadData(this.productsFetchHandler)

        this.productsAdminHandler = new lambdaNodJS.NodejsFunction(this,
            "ProductsAdminFunction", {
            runtime: lambda.Runtime.NODEJS_16_X,
            functionName: "ProductsAdminFunction",
            entry: "lambda/products/productsAdminFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName,
                PRODUCTS_EVENTS_FUNCTION_NAME: productsEventsHandler.functionName
            },
            layers: [productsLayer, productEventsLayer],
            tracing: lambda.Tracing.ACTIVE
        })
        this.productsDdb.grantWriteData(this.productsAdminHandler)
        productsEventsHandler.grantInvoke(this.productsAdminHandler)
    }
}