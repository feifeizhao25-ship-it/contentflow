import { DOMESTIC_TEXT_MODEL_PRICES } from './model-pricing';
import { QWEN_DEFAULT_MODEL } from './ai.service';

// 阿里云百炼官方价目页（中国内地 / 北京部署），2026-10-13 核对
describe('通义千问价目与默认模型', () => {
  it('核对过的三项按官方价目页锁定', () => {
    expect(DOMESTIC_TEXT_MODEL_PRICES['qwen-flash']).toMatchObject({ inputCnyPerMillion: 0.15, outputCnyPerMillion: 1.5, verified: true, checkedAt: '2026-10-13' });
    expect(DOMESTIC_TEXT_MODEL_PRICES['qwen-plus']).toMatchObject({ inputCnyPerMillion: 0.8, outputCnyPerMillion: 8, verified: true });
    expect(DOMESTIC_TEXT_MODEL_PRICES['qwen-max']).toMatchObject({ inputCnyPerMillion: 2.4, outputCnyPerMillion: 9.6, verified: true });
  });
  it('官方价目页已不再列出 qwen-turbo：只保留给历史记录计价并标待核实，默认改用 qwen-flash', () => {
    expect(DOMESTIC_TEXT_MODEL_PRICES['qwen-turbo'].verified).toBe(false);
    expect(DOMESTIC_TEXT_MODEL_PRICES['qwen-turbo'].note).toContain('待核实');
    expect(QWEN_DEFAULT_MODEL).toBe('qwen-flash');
  });
});
