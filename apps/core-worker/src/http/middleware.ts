import type { RequestContext } from "../contracts/context";

export type Middleware = (
  context: RequestContext,
  next: () => Promise<Response>,
) => Promise<Response>;

export function composeMiddleware(
  middlewares: Middleware[],
  terminal: (context: RequestContext) => Promise<Response>,
): (context: RequestContext) => Promise<Response> {
  return async function run(context: RequestContext): Promise<Response> {
    let index = -1;

    async function dispatch(position: number): Promise<Response> {
      if (position <= index) {
        throw new Error("Middleware chain called multiple times.");
      }

      index = position;

      if (position === middlewares.length) {
        return terminal(context);
      }

      const middleware = middlewares[position];
      return middleware(context, () => dispatch(position + 1));
    }

    return dispatch(0);
  };
}
