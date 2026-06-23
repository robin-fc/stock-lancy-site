import type { StockQuote, StockCandle, TechnicalIndicators, Signal, RiskLevel } from '@/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o-mini';

interface AIAnalysisResult {
  signal: Signal;
  confidence: number;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  analysis: string;
  summary: string;
  key_factors: string[];
  risk_level: RiskLevel;
}

/** 调用 OpenAI 生成股票分析 */
export async function analyzeStock(
  symbol: string,
  name: string,
  quote: StockQuote,
  candles: StockCandle[],
  indicators: TechnicalIndicators
): Promise<AIAnalysisResult> {
  // 如果没有 API key, 使用技术指标生成基础分析
  if (!OPENAI_API_KEY) {
    return generateFallbackAnalysis(symbol, name, quote, indicators);
  }

  const prompt = buildAnalysisPrompt(symbol, name, quote, candles, indicators);

  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一位专业的A股量化分析师和选股专家。你需要根据提供的技术指标和价格数据，对中国A股进行深度分析并给出投资建议。

请严格按照以下 JSON 格式返回结果（不要包含 markdown 代码块标记）：
{
  "signal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "confidence": 0-100的整数,
  "entry_price": 建议买入价(数字或null),
  "target_price": 目标价(数字或null),
  "stop_loss": 止损价(数字或null),
  "summary": "一句话总结(不超过50字)",
  "key_factors": ["关键因素1", "关键因素2", "关键因素3"],
  "risk_level": "low" | "medium" | "high",
  "analysis": "详细分析报告(Markdown格式, 300-500字, 包含技术面分析、资金面分析、风险提示)"
}

注意：
- signal 和 confidence 要基于技术指标客观判断
- entry_price 通常在当前价格附近
- target_price 是预期上涨目标
- stop_loss 是下方支撑位
- 分析要专业、客观，不要给出绝对性的承诺
- 用中文撰写分析内容`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      return generateFallbackAnalysis(symbol, name, quote, indicators);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return generateFallbackAnalysis(symbol, name, quote, indicators);
    }

    // 清理可能的 markdown 代码块标记
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      signal: result.signal,
      confidence: Math.max(0, Math.min(100, result.confidence)),
      entry_price: result.entry_price ?? null,
      target_price: result.target_price ?? null,
      stop_loss: result.stop_loss ?? null,
      analysis: result.analysis,
      summary: result.summary,
      key_factors: Array.isArray(result.key_factors) ? result.key_factors : [],
      risk_level: result.risk_level || 'medium',
    };
  } catch {
    return generateFallbackAnalysis(symbol, name, quote, indicators);
  }
}

/** 构建分析提示词 */
function buildAnalysisPrompt(
  symbol: string,
  name: string,
  quote: StockQuote,
  candles: StockCandle[],
  indicators: TechnicalIndicators
): string {
  const recentCandles = candles.slice(-10).map(c => ({
    date: c.date,
    close: c.close,
    volume: c.volume,
    change: ((c.close - c.open) / c.open * 100).toFixed(2) + '%',
  }));

  return `请分析以下A股数据：

股票代码: ${symbol}
股票名称: ${name}

当前价格数据:
- 当前价: ¥${quote.current_price.toFixed(2)}
- 涨跌额: ¥${quote.change.toFixed(2)}
- 涨跌幅: ${quote.change_pct.toFixed(2)}%
- 今日最高: ¥${quote.high.toFixed(2)}
- 今日最低: ¥${quote.low.toFixed(2)}
- 开盘价: ¥${quote.open.toFixed(2)}
- 昨收价: ¥${quote.prev_close.toFixed(2)}

技术指标:
- RSI(14): ${indicators.rsi.toFixed(2)}
- MACD: ${indicators.macd.toFixed(4)} (信号线: ${indicators.macd_signal.toFixed(4)})
- MA5: ¥${indicators.ma5.toFixed(2)}
- MA10: ¥${indicators.ma10.toFixed(2)}
- MA20: ¥${indicators.ma20.toFixed(2)}
- MA60: ¥${indicators.ma60.toFixed(2)}
- 布林带上轨: ¥${indicators.boll_upper.toFixed(2)}
- 布林带下轨: ¥${indicators.boll_lower.toFixed(2)}

近10日走势:
${JSON.stringify(recentCandles, null, 2)}

请根据以上数据进行综合分析，给出投资建议。注意这是中国A股市场，涨跌幅限制为±10%（创业板±20%）。`;
}

/** 无 API key 时的降级分析 (基于技术指标) */
function generateFallbackAnalysis(
  symbol: string,
  name: string,
  quote: StockQuote,
  indicators: TechnicalIndicators
): AIAnalysisResult {
  let score = 50;
  const factors: string[] = [];

  // RSI
  if (indicators.rsi < 30) {
    score += 15;
    factors.push(`RSI=${indicators.rsi.toFixed(0)}，处于超卖区域，存在反弹机会`);
  } else if (indicators.rsi > 70) {
    score -= 15;
    factors.push(`RSI=${indicators.rsi.toFixed(0)}，处于超买区域，注意回调风险`);
  } else {
    factors.push(`RSI=${indicators.rsi.toFixed(0)}，处于中性区域`);
  }

  // MACD
  if (indicators.macd > indicators.macd_signal) {
    score += 12;
    factors.push('MACD 金叉，短期动能向上');
  } else {
    score -= 12;
    factors.push('MACD 死叉，短期动能向下');
  }

  // 均线
  if (indicators.ma5 > indicators.ma20) {
    score += 10;
    factors.push('短期均线在中期均线之上，多头排列');
  } else {
    score -= 10;
    factors.push('短期均线在中期均线之下，空头排列');
  }

  score = Math.max(0, Math.min(100, score));

  let signal: Signal;
  if (score >= 75) signal = 'strong_buy';
  else if (score >= 60) signal = 'buy';
  else if (score >= 40) signal = 'hold';
  else if (score >= 25) signal = 'sell';
  else signal = 'strong_sell';

  const entryPrice = quote.current_price;
  const targetPrice = signal === 'strong_buy' || signal === 'buy'
    ? quote.current_price * 1.1
    : quote.current_price * 0.95;
  const stopLoss = quote.current_price * 0.92;

  const riskLevel: RiskLevel = Math.abs(score - 50) > 30 ? 'high' : score > 50 ? 'medium' : 'high';

  const signalText: Record<Signal, string> = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  };

  const analysis = `## 技术面分析

**${name}(${symbol})** 当前价格 ¥${quote.current_price.toFixed(2)}，涨跌幅 ${quote.change_pct.toFixed(2)}%。

### 指标解读
- **RSI**: ${indicators.rsi.toFixed(1)} ${indicators.rsi < 30 ? '（超卖）' : indicators.rsi > 70 ? '（超买）' : '（中性）'}
- **MACD**: ${indicators.macd > indicators.macd_signal ? '金叉' : '死叉'}，DIF=${indicators.macd.toFixed(4)}
- **均线系统**: MA5=¥${indicators.ma5.toFixed(2)}，MA20=¥${indicators.ma20.toFixed(2)}，${indicators.ma5 > indicators.ma20 ? '多头排列' : '空头排列'}
- **布林带**: 上轨=¥${indicators.boll_upper.toFixed(2)}，下轨=¥${indicators.boll_lower.toFixed(2)}

### 综合评分
综合技术指标评分: **${score}/100**，信号: **${signalText[signal]}**

### 操作建议
- 建议买入价: ¥${entryPrice?.toFixed(2)}
- 目标价: ¥${targetPrice?.toFixed(2)}
- 止损价: ¥${stopLoss?.toFixed(2)}

### 风险提示
本分析仅基于技术指标，不构成投资建议。股市有风险，投资需谨慎。`;

  return {
    signal,
    confidence: score,
    entry_price: entryPrice,
    target_price: targetPrice,
    stop_loss: stopLoss,
    analysis,
    summary: `${name}技术评分${score}分，信号${signalText[signal]}`,
    key_factors: factors,
    risk_level: riskLevel,
  };
}
