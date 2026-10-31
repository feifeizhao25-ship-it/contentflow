describe('注册年龄确认的提示语言', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => { process.env.MARKET_REGION = previous; jest.resetModules(); });

  it('国内版是中文，含「16 周岁」', () => {
    process.env.MARKET_REGION = 'cn';
    jest.isolateModules(() => {
      const { AGE_CONFIRMATION_MESSAGE } = require('./age-confirmation');
      expect(AGE_CONFIRMATION_MESSAGE).toBe('请确认您已年满 16 周岁');
    });
  });

  it('国际版是纯英文，含 16', () => {
    process.env.MARKET_REGION = 'global';
    jest.isolateModules(() => {
      const { AGE_CONFIRMATION_MESSAGE } = require('./age-confirmation');
      expect(AGE_CONFIRMATION_MESSAGE).toBe('Please confirm that you are 16 or older');
      expect(AGE_CONFIRMATION_MESSAGE).not.toMatch(/[\u3400-\u9fff]/);
    });
  });
});
