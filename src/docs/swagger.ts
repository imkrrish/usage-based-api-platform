export interface SwaggerDocument {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export const swaggerSpec: SwaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Usage-Based API Platform",
    description:
      "A TypeScript/Node.js service simulating a usage-based API platform with deployment lifecycle management, API authentication, rate limiting, usage metering, and billing.",
    version: "1.0.0",
    contact: {
      name: "Krishan Kumar",
    },
  },
  servers: [
    {
      url: "/api",
      description: "",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Returns the health status of the API",
        operationId: "getHealth",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Successful health check",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "timestamp"],
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/deployments": {
      post: {
        summary: "Create a new deployment",
        description:
          "Creates a new deployment for the specified model. The deployment starts in 'provisioning' status and transitions to 'ready' after approximately 10 seconds. When ready, endpoint_url and api_key become available.",
        operationId: "createDeployment",
        tags: ["Deployments"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateDeploymentRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Deployment created successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateDeploymentResponse",
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
        },
      },
    },
    "/deployments/{id}": {
      get: {
        summary: "Get deployment status",
        description:
          "Returns the current deployment status. When status is 'ready', endpoint_url and api_key are included in the response.",
        operationId: "getDeployment",
        tags: ["Deployments"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Deployment ID",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deployment details",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GetDeploymentResponse",
                },
              },
            },
          },
          "404": {
            description: "Deployment not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "Terminate a deployment",
        description:
          "Marks the deployment as terminated (soft delete). Once terminated, a deployment cannot transition to any other state.",
        operationId: "deleteDeployment",
        tags: ["Deployments"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Deployment ID",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "204": {
            description: "Deployment terminated successfully",
          },
          "404": {
            description: "Deployment not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
          "409": {
            description:
              "Invalid state transition - cannot terminate from current state",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
        },
      },
    },
    "/v1/{deployment_id}/completions": {
      post: {
        summary: "Create a completion",
        description:
          "Creates a completion for the specified deployment. Requires Bearer token authentication with a valid API key. Only ready deployments can process completion requests.",
        operationId: "createCompletion",
        tags: ["Completions"],
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "deployment_id",
            in: "path",
            required: true,
            description: "Deployment ID",
            schema: {
              type: "string",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateCompletionRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Completion created successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateCompletionResponse",
                },
              },
            },
          },
          "400": {
            description: "Validation error - prompt must be a non-empty string",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized - missing or invalid API key",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
          "403": {
            description:
              "Forbidden - API key does not belong to this deployment",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
          "409": {
            description: "Conflict - deployment is provisioning or terminated",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
        },
      },
    },
    "/usage": {
      get: {
        summary: "Get usage and billing data",
        description:
          "Returns aggregated usage and billing data for an API key within a time range. Days are grouped in UTC (YYYY-MM-DD). Pricing: input $0.001 per 1k tokens, output $0.002 per 1k tokens.",
        operationId: "getUsage",
        tags: ["Usage"],
        parameters: [
          {
            name: "api_key",
            in: "query",
            required: true,
            description: "API key to query usage for",
            schema: {
              type: "string",
            },
          },
          {
            name: "from",
            in: "query",
            required: true,
            description: "Start of the time range (ISO 8601 datetime, UTC)",
            schema: {
              type: "string",
              format: "date-time",
            },
            example: "2026-01-01T00:00:00.000Z",
          },
          {
            name: "to",
            in: "query",
            required: true,
            description: "End of the time range (ISO 8601 datetime, UTC)",
            schema: {
              type: "string",
              format: "date-time",
            },
            example: "2026-01-31T23:59:59.999Z",
          },
          {
            name: "group_by",
            in: "query",
            required: true,
            description: "How to group the usage breakdown",
            schema: {
              type: "string",
              enum: ["day", "model"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Usage data aggregated successfully. Empty ranges return zeros and an empty breakdown.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UsageResponse",
                },
              },
            },
          },
          "400": {
            description:
              "Validation error - missing/invalid api_key, from, to, or group_by",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApiError",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CreateDeploymentRequest: {
        type: "object",
        required: ["model"],
        properties: {
          model: {
            type: "string",
            enum: ["model-a", "model-b"],
            description: "The model type for the deployment",
            example: "model-a",
          },
        },
      },
      CreateDeploymentResponse: {
        type: "object",
        required: ["deployment_id", "status"],
        properties: {
          deployment_id: {
            type: "string",
            description: "Unique deployment identifier",
            example: "dep_abc123_xyz456",
          },
          status: {
            type: "string",
            enum: ["provisioning", "ready", "terminated"],
            description: "Current deployment status",
            example: "provisioning",
          },
        },
      },
      GetDeploymentResponse: {
        type: "object",
        required: [
          "deployment_id",
          "status",
          "model",
          "created_at",
          "updated_at",
        ],
        properties: {
          deployment_id: {
            type: "string",
            description: "Unique deployment identifier",
            example: "dep_abc123_xyz456",
          },
          status: {
            type: "string",
            enum: ["provisioning", "ready", "terminated"],
            description: "Current deployment status",
            example: "ready",
          },
          model: {
            type: "string",
            enum: ["model-a", "model-b"],
            description: "The model type for the deployment",
            example: "model-a",
          },
          endpoint_url: {
            type: "string",
            description:
              "API endpoint URL (only available when status is 'ready')",
            example: "https://api.example.com/v1/dep_abc123_xyz456",
          },
          api_key: {
            type: "string",
            description:
              "API key for authentication (only available when status is 'ready')",
            example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Deployment creation timestamp",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            description: "Deployment last update timestamp",
          },
        },
      },
      CreateCompletionRequest: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "The prompt to generate a completion for",
            example: "What is the meaning of life?",
          },
        },
      },
      CreateCompletionResponse: {
        type: "object",
        required: ["output", "input_tokens", "output_tokens"],
        properties: {
          output: {
            type: "string",
            description: "The generated completion",
            example: "mocked response",
          },
          input_tokens: {
            type: "integer",
            description:
              "Number of input tokens (calculated as prompt.length / 4 rounded)",
            example: 12,
          },
          output_tokens: {
            type: "integer",
            description: "Number of output tokens (random between 50-200)",
            example: 127,
            minimum: 50,
            maximum: 200,
          },
        },
      },
      UsageTotals: {
        type: "object",
        required: [
          "input_tokens",
          "output_tokens",
          "total_tokens",
          "input_cost",
          "output_cost",
          "total_cost",
        ],
        properties: {
          input_tokens: {
            type: "integer",
            description: "Sum of input tokens in the range",
            example: 1200,
          },
          output_tokens: {
            type: "integer",
            description: "Sum of output tokens in the range",
            example: 340,
          },
          total_tokens: {
            type: "integer",
            description: "input_tokens + output_tokens",
            example: 1540,
          },
          input_cost: {
            type: "number",
            description: "input_tokens / 1000 * 0.001",
            example: 0.0012,
          },
          output_cost: {
            type: "number",
            description: "output_tokens / 1000 * 0.002",
            example: 0.00068,
          },
          total_cost: {
            type: "number",
            description: "input_cost + output_cost",
            example: 0.00188,
          },
        },
      },
      UsageGroupItem: {
        type: "object",
        required: [
          "key",
          "input_tokens",
          "output_tokens",
          "total_tokens",
          "input_cost",
          "output_cost",
          "total_cost",
        ],
        properties: {
          key: {
            type: "string",
            description:
              "Group key: UTC date (YYYY-MM-DD) when group_by=day, or model name when group_by=model",
            example: "2026-01-15",
          },
          input_tokens: {
            type: "integer",
            example: 400,
          },
          output_tokens: {
            type: "integer",
            example: 120,
          },
          total_tokens: {
            type: "integer",
            example: 520,
          },
          input_cost: {
            type: "number",
            example: 0.0004,
          },
          output_cost: {
            type: "number",
            example: 0.00024,
          },
          total_cost: {
            type: "number",
            example: 0.00064,
          },
        },
      },
      UsageResponse: {
        type: "object",
        required: [
          "api_key",
          "from",
          "to",
          "group_by",
          "totals",
          "breakdown",
        ],
        properties: {
          api_key: {
            type: "string",
            description: "The API key that was queried",
          },
          from: {
            type: "string",
            format: "date-time",
            description: "Start of the queried range (ISO 8601 UTC)",
          },
          to: {
            type: "string",
            format: "date-time",
            description: "End of the queried range (ISO 8601 UTC)",
          },
          group_by: {
            type: "string",
            enum: ["day", "model"],
          },
          totals: {
            $ref: "#/components/schemas/UsageTotals",
          },
          breakdown: {
            type: "array",
            description: "Grouped usage rows. Empty array when no events match.",
            items: {
              $ref: "#/components/schemas/UsageGroupItem",
            },
          },
        },
      },
      ApiError: {
        type: "object",
        required: ["statusCode", "message", "code"],
        properties: {
          statusCode: {
            type: "integer",
            description: "HTTP status code",
            example: 400,
          },
          message: {
            type: "string",
            description: "Error message",
            example: "Model is required",
          },
          code: {
            type: "string",
            description: "Error code",
            example: "VALIDATION_ERROR",
          },
          details: {
            type: "object",
            description: "Additional error details",
            additionalProperties: true,
          },
        },
      },
    },
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "Bearer token authentication using API key",
      },
    },
  },
  tags: [
    {
      name: "Health",
      description: "Health check endpoints",
    },
    {
      name: "Deployments",
      description: "Deployment lifecycle management",
    },
    {
      name: "Completions",
      description: "Completion API endpoints",
    },
    {
      name: "Usage",
      description: "Usage metering and billing",
    },
  ],
};
