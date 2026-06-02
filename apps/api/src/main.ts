import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { AuthBootstrapService } from "./auth/auth.bootstrap.service";

function cookieParser(req: { headers: { cookie?: string }; cookies?: Record<string, string> }, _: unknown, next: () => void) {
  const raw = req.headers.cookie;
  req.cookies = {};
  if (!raw) {
    next();
    return;
  }
  const pairs = raw.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = decodeURIComponent(trimmed.slice(0, i));
    const value = decodeURIComponent(trimmed.slice(i + 1));
    req.cookies[key] = value;
  }
  next();
}

function validateEnv() {
  const required = ["DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]?.trim() || String(process.env[k]).includes("placeholder"));
  if (missing.length) {
    console.warn(`[Tyvera API] Missing or placeholder env: ${missing.join(", ")}. Some features may be unavailable.`);
  }
  if (process.env.OPENAI_API_KEY?.includes("placeholder")) {
    console.warn("[Tyvera API] OPENAI_API_KEY is placeholder. AI messaging will be disabled.");
  }
  if (process.env.PAYMONGO_SECRET_KEY?.includes("placeholder") || !process.env.PAYMONGO_SECRET_KEY) {
    console.warn("[Tyvera API] PayMongo not configured. Billing checkout will be unavailable.");
  }
  const twilioOk =
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim()) &&
    !String(process.env.TWILIO_ACCOUNT_SID).toLowerCase().includes("placeholder");
  const resendOk =
    process.env.RESEND_API_KEY?.trim() &&
    process.env.RESEND_FROM_EMAIL?.trim() &&
    !String(process.env.RESEND_API_KEY).toLowerCase().includes("placeholder");
  if (
    (process.env.FF_auto_messaging_enabled === "true" || process.env.FF_auto_followups_scheduler_enabled === "true") &&
    !twilioOk &&
    !resendOk
  ) {
    console.warn(
      "[Tyvera API] Messaging flags enabled but Twilio/Resend not configured. Auto-sends will use noop (no real delivery).",
    );
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(cookieParser as never);
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

  const authBootstrap = app.get(AuthBootstrapService);
  await authBootstrap.ensureDefaultAccount();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Tyvera API running on http://localhost:${port}`);
}

bootstrap();
