import type { Middleware } from "../http/middleware";

function normalizeLocale(input: string | null, fallback: string): string {
  if (!input) {
    return fallback;
  }

  return input.split(",")[0]?.trim() || fallback;
}

export const localeMiddleware: Middleware = async (context, next) => {
  const explicit = context.request.headers.get("x-locale");
  const acceptLanguage = context.request.headers.get("accept-language");
  context.locale = normalizeLocale(explicit ?? acceptLanguage, context.env.DEFAULT_LOCALE);
  return next();
};
