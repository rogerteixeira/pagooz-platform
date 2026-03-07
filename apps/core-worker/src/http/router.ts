import { notFound } from "./errors";

export type RouteHandler = (
  context: import("../contracts/context").RequestContext,
  params: Record<string, string>,
) => Promise<Response>;

export interface Route {
  method: "GET" | "POST";
  path: string;
  handler: RouteHandler;
  meta: {
    requires_tenant_mode: boolean;
    requires_auth: boolean;
    requires_idempotency: boolean;
    required_scopes: readonly string[];
    allow_operational_bypass: boolean;
  };
}

interface CompiledRoute {
  method: Route["method"];
  matcher: RegExp;
  param_keys: string[];
  route: Route;
}

function compilePath(path: string): { matcher: RegExp; param_keys: string[] } {
  const parts = path.split("/").filter(Boolean);
  const param_keys: string[] = [];

  const pattern = parts
    .map((segment) => {
      if (segment.startsWith(":")) {
        const key = segment.slice(1);
        param_keys.push(key);
        return "([^/]+)";
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return {
    matcher: new RegExp(`^/${pattern}$`),
    param_keys,
  };
}

export function createRouter(routes: Route[]) {
  const compiled: CompiledRoute[] = routes.map((route) => {
    const { matcher, param_keys } = compilePath(route.path);
    return {
      method: route.method,
      matcher,
      param_keys,
      route,
    };
  });

  return {
    match(method: string, pathname: string): {
      route: Route;
      params: Record<string, string>;
    } {
      for (const item of compiled) {
        if (item.method !== method) {
          continue;
        }

        const match = pathname.match(item.matcher);
        if (!match) {
          continue;
        }

        const params: Record<string, string> = {};
        item.param_keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1] ?? "");
        });

        return {
          route: item.route,
          params,
        };
      }

      throw notFound("route_not_found", "Route not found.");
    },
  };
}
