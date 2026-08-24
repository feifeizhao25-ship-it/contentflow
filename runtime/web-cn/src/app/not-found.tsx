import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-6">
            <div className="text-center max-w-md">
                <p className="text-7xl font-black text-indigo-500 mb-4">404</p>
                <h1 className="text-2xl font-bold text-zinc-900 mb-3">页面不存在</h1>
                <p className="text-zinc-500 mb-8 leading-relaxed">
                    您访问的页面不存在或已被移动，请检查地址是否正确。
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-colors"
                >
                    返回首页
                </Link>
            </div>
        </div>
    );
}
