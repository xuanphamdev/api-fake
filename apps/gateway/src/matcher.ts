import { match } from 'path-to-regexp';

interface EndpointConfig {
  id: string;
  path: string;
  method: string;
}

export interface MatchResult {
  endpoint: any;
  params: Record<string, string>;
}

export function matchRoute(
  method: string,
  pathname: string,
  endpoints: any[]
): MatchResult | null {
  const reqMethod = method.toUpperCase();

  for (const ep of endpoints) {
    if (ep.method.toUpperCase() !== reqMethod) {
      continue;
    }

    try {
      // Create matcher function for the configured endpoint path
      const matcher = match(ep.path, { decode: decodeURIComponent, sensitive: false });
      const result = matcher(pathname);

      if (result) {
        return {
          endpoint: ep,
          params: result.params as Record<string, string>,
        };
      }
    } catch (error) {
      console.error(`Error matching path pattern ${ep.path} against ${pathname}:`, error);
    }
  }

  return null;
}
