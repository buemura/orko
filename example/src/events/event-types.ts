export enum WorkflowTypes {
  ProcessOrder = "ProcessOrder",
}

export enum EventTypes {
  // Order events
  OrderCreated = "OrderCreated",
  OrderCanceled = "OrderCanceled",

  // Stock events
  StockUpdate = "StockUpdate",

  // Payment events
  PaymentRequested = "PaymentRequested",
  PaymentCompleted = "PaymentCompleted",
  PaymentFailed = "PaymentFailed",

  // Workflow events
  ProcessOrder = "ProcessOrder",
}
