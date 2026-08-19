        refreshToken: this.jwtService.sign({ ...payload, type: 'refresh' }, {
          secret: this.configService.get('jwt.refreshSecret'),
          expiresIn: this.configService.get('jwt.refreshExpiresIn'),
          issuer: 'contentflow',
          audience: 'contentflow-api',
        refreshToken: this.jwtService.sign({ ...payload, type: 'refresh' }, {
          secret: this.configService.get('jwt.refreshSecret'),
          expiresIn: this.configService.get('jwt.refreshExpiresIn'),
          issuer: 'contentflow',
          audience: 'contentflow-api',
