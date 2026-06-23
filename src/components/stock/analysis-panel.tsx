import * as React from "react";
import { cn } from "@/lib/utils";

export interface AnalysisPanelProps {
  /** Markdown 格式的分析文本 */
  analysis: string;
  className?: string;
}

/**
 * 简易 Markdown 渲染器
 * 支持: ## ### 标题, **粗体**, -/* 列表, 段落
 */
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  /** 将行内 **粗体** 转为 <strong> */
  function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={`${keyPrefix}-b-${i++}`}>{match[1]}</strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  }

  function flushList() {
    if (listItems.length === 0) return;
    if (listType === "ol") {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="list-decimal">
          {listItems}
        </ol>
      );
    } else {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc">
          {listItems}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 空行
    if (trimmed === "") {
      flushList();
      return;
    }

    // 标题
    if (trimmed.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={`h3-${idx}`}>{renderInline(trimmed.slice(4), `h3-${idx}`)}</h3>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      nodes.push(
        <h2 key={`h2-${idx}`}>{renderInline(trimmed.slice(3), `h2-${idx}`)}</h2>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      nodes.push(
        <h2 key={`h1-${idx}`}>{renderInline(trimmed.slice(2), `h1-${idx}`)}</h2>
      );
      return;
    }

    // 有序列表
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(
        <li key={`li-${idx}`}>{renderInline(olMatch[1], `li-${idx}`)}</li>
      );
      return;
    }

    // 无序列表
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(
        <li key={`li-${idx}`}>{renderInline(ulMatch[1], `li-${idx}`)}</li>
      );
      return;
    }

    // 普通段落
    flushList();
    nodes.push(
      <p key={`p-${idx}`}>{renderInline(trimmed, `p-${idx}`)}</p>
    );
  });

  flushList();
  return nodes;
}

/**
 * 分析报告面板 (邀请制下所有会员均可查看完整内容)
 */
export function AnalysisPanel({ analysis, className }: AnalysisPanelProps) {
  return (
    <div className={cn("prose-stocks", className)}>
      {renderMarkdown(analysis)}
    </div>
  );
}
