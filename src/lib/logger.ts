import pino from "pino";

const sensitiveKeys = [
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "apiKey",
  "secret",
  "email",
  "phone",
  "phone_number",
  "cpf",
  "rg",
];

function redactValue(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase();

  if (sensitiveKeys.some((sensitive) => normalizedKey.includes(sensitive))) {
    return "[REDACTED]";
  }

  return value;
}

function sanitize(input: unknown): unknown {
  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      stack: input.stack,
    };
  }

  if (Array.isArray(input)) {
    return input.map(sanitize);
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        redactValue(key, sanitize(value)),
      ]),
    );
  }

  return input;
}

const logger = pino({
  level: import.meta.env?.MODE === "development" ? "debug" : "info",
  browser: {
    asObject: true,
  },
  redact: {
    paths: [
      "password",
      "senha",
      "token",
      "access_token",
      "refresh_token",
      "authorization",
      "headers.authorization",
      "apikey",
      "apiKey",
      "secret",
      "email",
      "phone",
      "phone_number",
      "*.password",
      "*.token",
      "*.email",
      "*.phone_number",
    ],
    censor: "[REDACTED]",
  },
});

export function logInfo(message: string, context: Record<string, unknown> = {}) {
  logger.info(sanitize(context), message);
}

export function logWarn(message: string, context: Record<string, unknown> = {}) {
  logger.warn(sanitize(context), message);
}

export function logError(message: string, context: Record<string, unknown> = {}) {
  logger.error(sanitize(context), message);
}

export function logFatal(message: string, context: Record<string, unknown> = {}) {
  logger.fatal(sanitize(context), message);
}

export { logger };
