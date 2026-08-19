        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn'),
          issuer: 'contentflow',
          audience: 'contentflow-api',
        },