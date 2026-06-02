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
  const isConfigured = (name: string) => {
    const value = process.env[name]?.trim();
    return !!value && !value.toLowerCase().includes("placeholder");
  };
  const required = ["DATABASE_URL"];
  const missing = required.filter((k) => !isConfigured(k));
  if (missing.length) {
    console.warn(`[Tyvera API] Missing or placeholder env: ${missing.join(", ")}. Some features may be unavailable.`);
  }
  if (process.env.OPENAI_API_KEY?.includes("placeholder")) {
    console.warn("[Tyvera API] OPENAI_API_KEY is placeholder. AI messaging will be disabled.");
  }
  if (process.env.PAYMONGO_SECRET_KEY?.includes("placeholder") || !process.env.PAYMONGO_SECRET_KEY) {
    console.warn("[Tyvera API] PayMongo not configured. Billing checkout will be unavailable.");
  }
  const twilioCredentialsOk = isConfigured("TWILIO_ACCOUNT_SID") && isConfigured("TWILIO_AUTH_TOKEN");
  const twilioSenderOk = isConfigured("TWILIO_MESSAGING_SERVICE_SID") || isConfigured("TWILIO_PHONE_NUMBER");
  const twilioOk = twilioCredentialsOk && twilioSenderOk;
  const twilioVerifyOk = twilioCredentialsOk && isConfigured("TWILIO_VERIFY_SERVICE_SID");
  const twilioInboundValidationOk = twilioCredentialsOk && isConfigured("TWILIO_INBOUND_SMS_WEBHOOK_URL");
  const resendOk =
    process.env.RESEND_API_KEY?.trim() &&
    process.env.RESEND_FROM_EMAIL?.trim() &&
    !String(process.env.RESEND_API_KEY).toLowerCase().includes("placeholder");
  if (!twilioOk) {
    console.warn(
      "[Tyvera API] Twilio outbound SMS is not fully configured. SMS delivery will use noop when selected.",
    );
  }
  if (!twilioVerifyOk) {
    console.warn("[Tyvera API] Twilio Verify OTP is not fully configured. Public booking OTP SMS will be unavailable.");
  }
  if (!twilioInboundValidationOk) {
    console.warn(
      "[Tyvera API] Twilio inbound SMS webhook validation is not fully configured. Set TWILIO_AUTH_TOKEN and TWILIO_INBOUND_SMS_WEBHOOK_URL before production STOP handling.",
    );
  }
  if (twilioOk && !isConfigured("TWILIO_STATUS_CALLBACK_URL")) {
    console.warn("[Tyvera API] TWILIO_STATUS_CALLBACK_URL is not configured. Delivery status callbacks may be disabled.");
  }
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
