export enum ProductEventType {
    CREATED = "PRODUCT_CREATED",
    UPDATE = "PRODUCT_UPDATE",
    DELETE = "PRODUCT_DELETE"
}

export interface ProductEvent {
    requestId: string;
    eventType: ProductEventType;
    productId: string;
    productCode: string;
    productPrice: number;
    email: string;
}