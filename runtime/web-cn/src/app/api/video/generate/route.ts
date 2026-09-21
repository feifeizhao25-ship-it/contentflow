import { notAvailableInChina } from '../../_lib/provider';

// 视频生成：原实现直连境外服务商，国内版在接入境内供应商前不开通（见 _lib/provider.ts）。
export async function POST() {
  return notAvailableInChina('视频生成');
}
