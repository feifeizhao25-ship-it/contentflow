interface ProxyOptions {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  forwardBody?: boolean;
  forwardSearch?: boolean;
  silent?: boolean;
}
export async function proxyToGateway(request: Request, options: ProxyOptions): Promise<Response> {
  const { path, forwardBody = true, forwardSearch = true } = options;
  } catch (error) {
    if (!options.silent) {
      console.error(`Gateway proxy error [${path}]:`, error);
    }
    return Response.json(
