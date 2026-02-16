import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

function validateEnv() {
  const required = ["DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]?.trim() || String(process.env[k]).includes("placeholder"));
  if (missing.length) {
    console.warn(`[Suki API] Missing or placeholder env: ${missing.join(", ")}. Some features may be unavailable.`);
  }
  if (process.env.OPENAI_API_KEY?.includes("placeholder")) {
    console.warn("[Suki API] OPENAI_API_KEY is placeholder. AI messaging will be disabled.");
  }
  if (process.env.PAYMONGO_SECRET_KEY?.includes("placeholder") || !process.env.PAYMONGO_SECRET_KEY) {
    console.warn("[Suki API] PayMongo not configured. Billing checkout will be unavailable.");
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Suki API running on http://localhost:${port}`);
}

bootstrap();
