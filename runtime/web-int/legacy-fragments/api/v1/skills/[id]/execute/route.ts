export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToGateway(request, { path: 'v1/skills/execute/' + params.id });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToGateway(request, { path: 'v1/skills/execute/' + params.id });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToGateway(request, { path: 'v1/skills/execute/' + params.id });
}
