import { redirect } from 'next/navigation';

/**
 * 支付宝电脑网站支付的同步返回地址（ALIPAY_RETURN_URL 的示例值指向这里）。
 * 原来这个页面不存在：付完款回到 404。同步返回不代表支付成功（以异步通知为准），
 * 所以只把参数原样带回会员页，由会员页轮询后端确认权益是否到账。
 */
export default async function PaymentResultPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
        for (const item of Array.isArray(value) ? value : value == null ? [] : [value]) params.append(key, item);
    }
    const query = params.toString();
    redirect(query ? `/pricing?${query}` : '/pricing');
}
