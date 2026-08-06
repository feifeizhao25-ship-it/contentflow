  try {
    const res = await proxyToGateway(request, { path: 'v1/billing/usage/snapshot', silent: true });
