  async getUserByEmail(data: { email: string; tenantId: string }) {
    return this.userService.getUserByEmail(data.email, data.tenantId);
  }

  @GrpcMethod('UserService', 'ValidateCredentials')
  async validateCredentials(data: { email: string; password: string; tenantId: string }) {
    const user = await this.userService.validateUser(data.email, data.password, data.tenantId);
    return user ? { valid: true, user } : { valid: false };
  }