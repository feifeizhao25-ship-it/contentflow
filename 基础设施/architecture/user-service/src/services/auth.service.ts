  async revokeToken(token: string): Promise<{ success: boolean }> {
    if (!token) throw new UnauthorizedException('Token is required');
    if (
      process.env.NODE_ENV === 'production'
      && process.env.AUTH_SINGLE_INSTANCE !== 'true'
    ) {
      throw new ServiceUnavailableException(
        'Distributed token revocation storage is required for multi-instance production deployments',
      );
    }
    this.revokedTokens.add(token);