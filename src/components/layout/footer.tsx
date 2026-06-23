import Link from "next/link";
import { TrendingUp, ExternalLink, Code, AlertTriangle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* 风险提示 */}
        <div className="mb-8 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-[var(--yellow)]"
          />
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">
              风险提示：
            </span>
            本平台提供的所有选股信号、分析报告及数据仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。请根据自身风险承受能力做出独立判断，本平台不对任何投资损失承担责任。
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* 版权 + Logo */}
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <TrendingUp className="text-[var(--accent)]" size={18} />
              <span className="text-[var(--text-primary)]">AI选股器</span>
            </Link>
            <p className="text-xs text-[var(--text-muted)]">
              © 2026 stock.lancy.site 保留所有权利
            </p>
          </div>

          {/* 链接 */}
          <div className="flex items-center gap-5">
            <Link
              href="https://lancy.site"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              lancy.site 主站
              <ExternalLink size={14} />
            </Link>
            <Link
              href="https://github.com/lancy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <Code size={16} />
              GitHub
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
