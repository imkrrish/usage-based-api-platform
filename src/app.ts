import express from "express";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { swaggerSpec } from "./docs/swagger.js";

export function createApp(): express.Application {
  const app = express();

  // Body parser middleware
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // Swagger UI
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // API routes
  app.use("/", router);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}
