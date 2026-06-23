import type { StockQuote, StockCandle, TechnicalIndicators, Signal, RiskLevel } from '@/types';

const AGNES_API_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const MODEL = 'agnes-2.0-flash';

export interface FactorScore {
  score: number;        // 0-100
  weight: number;       // 0-1
  contribution: number; // score * weight
  detail: string;       // 该因子的分析说明
}

export interface StrategyResult {
  strategy: string;
  signal: Signal;
  score: number;
  reason: string;
}

export interface AIAnalysisResult {
  signal: Signal;
  confidence: number;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  analysis: string;
  summary: string;
  key_factors: string[];
  risk_level: RiskLevel;
  factor_scores: Record<string, FactorScore>;
  strategies: StrategyResult[];
  formula_version: string;
}

/** 因子权重 (从数据库加载, 默认均分) */
let cachedFactors: { key: string; weight: number }[] | null = null;

/** 设置因子权重 (由 API 路由在调用前注入) */
export function setFactorWeights(factors: { key: string; weight: number }[]) {
  cachedFactors = factors;
}

/** 获取当前因子权重 */
function getFactorWeights(): Record<string, number> {
  const defaults: Record<string, number> = {
    technical: 0.125,
    fundamental: 0.125,
    policy: 0.125,
    market_sentiment: 0.125,
    industry: 0.125,
    financial_report: 0.125,
    momentum: 0.125,
    value: 0.125,
  };

  if (cachedFactors && cachedFactors.length > 0) {
    for (const f of cachedFactors) {
      defaults[f.key] = f.weight;
    }
  }

  return defaults;
}

/**
 * 调用 AI 生成深度股票分析
 * 包含: 技术面、基本面、政策面、市场情绪、行业面、财报面、动量策略、价值策略
 * 多策略交叉印证 + 因子权重透明化
 */
export async function analyzeStock(
  symbol: string,
  name: string,
  quote: StockQuote,
  candles: StockCandle[],
  indicators: TechnicalIndicators,
  basicInfo?: {
    pe_ratio: number | null;
    pb_ratio: number | null;
    market_cap: number | null;
    sector: string | null;
  } | null
): Promise<AIAnalysisResult> {
  const weights = getFactorWeights();
  const formulaVersion = `v1-${new Date().toISOString().split('T')[0]}`;

  // 如果没有 API key, 使用技术指标生成基础分析
  if (!AGNES_API_KEY) {
    return generateFallbackAnalysis(symbol, name, quote, candles, indicators, basicInfo, weights, formulaVersion);
  }

  const prompt = buildDeepAnalysisPrompt(symbol, name, quote, candles, indicators, basicInfo, weights);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${AGNES_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: DEEP_ANALYSIS_SYSTEM_PROMPT,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return generateFallbackAnalysis(symbol, name, quote, candles, indicators, basicInfo, weights, formulaVersion);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return generateFallbackAnalysis(symbol, name, quote, candles, indicators, basicInfo, weights, formulaVersion);
    }

    // 清理可能的 markdown 代码块标记
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // 构建因子分数
    const factorScores: Record<string, FactorScore> = {};
    const rawFactors = result.factor_scores || {};
    for (const [key, val] of Object.entries(rawFactors)) {
      const v = val as any;
      factorScores[key] = {
        score: Math.max(0, Math.min(100, v.score || 50)),
        weight: weights[key] || 0.125,
        contribution: ((v.score || 50) * (weights[key] || 0.125)),
        detail: v.detail || '',
      };
    }

    // 构建策略结果
    const strategies: StrategyResult[] = (result.strategies || []).map((s: any) => ({
      strategy: s.strategy || '',
      signal: s.signal || 'hold',
      score: Math.max(0, Math.min(100, s.score || 50)),
      reason: s.reason || '',
    }));

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
      factor_scores: factorScores,
      strategies,
      formula_version: formulaVersion,
    };
  } catch {
    return generateFallbackAnalysis(symbol, name, quote, candles, indicators, basicInfo, weights, formulaVersion);
  }
}

const DEEP_ANALYSIS_SYSTEM_PROMPT = `你是一位顶级的A股量化分析师和选股专家，擅长多维度深度分析。你需要从技术面、基本面、政策面、市场情绪、行业面、财报面、动量策略、价值策略8个维度对股票进行全方位分析。

## 分析框架

### 8大分析因子
1. **技术面分析** (technical): RSI、MACD、均线系统、布林带、成交量等技术指标综合研判
2. **基本面分析** (fundamental): 市盈率、市净率、总市值、估值分位、行业估值对比
3. **政策面分析** (policy): 国家政策方向、行业监管动态、产业扶持/限制政策对该股的影响
4. **市场情绪** (market_sentiment): 资金流向、成交量变化、市场恐慌/贪婪程度、主力资金动向
5. **行业面分析** (industry): 行业景气度、竞争格局、产业链位置、行业增长前景
6. **财报面分析** (financial_report): 营收增长、利润变化、现金流状况、资产负债率、ROE等
7. **动量策略** (momentum): 近期涨跌幅、相对强度、趋势延续性、动量因子
8. **价值策略** (value): 估值安全边际、内在价值评估、PEG、股息率等

### 多策略交叉印证
需要从以下策略角度分别给出独立判断:
- 技术策略: 纯技术指标驱动
- 价值策略: 估值驱动
- 动量策略: 趋势驱动
- 综合策略: 上述策略加权融合

### 输出要求
严格按照以下JSON格式返回（不要包含markdown代码块标记）：
{
  "factor_scores": {
    "technical": { "score": 0-100, "detail": "该因子详细分析(50-100字)" },
    "fundamental": { "score": 0-100, "detail": "..." },
    "policy": { "score": 0-100, "detail": "..." },
    "market_sentiment": { "score": 0-100, "detail": "..." },
    "industry": { "score": 0-100, "detail": "..." },
    "financial_report": { "score": 0-100, "detail": "..." },
    "momentum": { "score": 0-100, "detail": "..." },
    "value": { "score": 0-100, "detail": "..." }
  },
  "strategies": [
    { "strategy": "技术策略", "signal": "hold", "score": 50, "reason": "策略判断依据(30-50字)" },
    { "strategy": "价值策略", "signal": "hold", "score": 50, "reason": "..." },
    { "strategy": "动量策略", "signal": "hold", "score": 50, "reason": "..." },
    { "strategy": "综合策略", "signal": "hold", "score": 50, "reason": "..." }
  ],
  "signal": "strong_buy|buy|hold|sell|strong_sell",
  "confidence": 0-100的整数,
  "entry_price": 数字或null,
  "target_price": 数字或null,
  "stop_loss": 数字或null,
  "summary": "一句话总结(不超过50字)",
  "key_factors": ["关键因素1", "关键因素2", "关键因素3", "关键因素4"],
  "risk_level": "low|medium|high",
  "analysis": "详细分析报告(Markdown格式, 800-1500字, 必须包含以下章节: ## 技术面分析 ## 基本面与估值 ## 政策与行业 ## 财报分析 ## 市场情绪与资金 ## 多策略交叉印证 ## 综合评分与建议 ## 风险提示)"
}

注意:
- 每个因子的score要客观反映该维度的实际情况
- 多策略之间可能给出不同信号, 这正是交叉印证的价值
- 最终signal是综合所有因子和策略后的判断
- confidence反映分析的确定性, 不是分数高低
- 如果某些数据缺失(如财报数据), 基于已有信息合理推断并注明
- 用中文撰写所有内容
- analysis部分要专业、深入, 体现真正的分析逻辑而非简单罗列`;

/** 构建深度分析提示词 */
function buildDeepAnalysisPrompt(
  symbol: string,
  name: string,
  quote: StockQuote,
  candles: StockCandle[],
  indicators: TechnicalIndicators,
  basicInfo: {
    pe_ratio: number | null;
    pb_ratio: number | null;
    market_cap: number | null;
    sector: string | null;
  } | null | undefined,
  weights: Record<string, number>
): string {
  const recentCandles = candles.slice(-20).map(c => ({
    date: c.date,
    close: c.close,
    volume: c.volume,
    change: ((c.close - c.open) / c.open * 100).toFixed(2) + '%',
  }));

  // 近5日/20日/60日涨跌幅
  const lastClose = candles[candles.length - 1].close;
  const close5 = candles.length > 5 ? candles[candles.length - 6].close : lastClose;
  const close20 = candles.length > 20 ? candles[candles.length - 21].close : lastClose;
  const close60 = candles.length > 60 ? candles[candles.length - 61].close : lastClose;
  const chg5 = ((lastClose - close5) / close5 * 100).toFixed(2);
  const chg20 = ((lastClose - close20) / close20 * 100).toFixed(2);
  const chg60 = ((lastClose - close60) / close60 * 100).toFixed(2);

  // 平均成交量
  const avgVol20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / Math.min(20, candles.length);
  const volRatio = (quote.volume / avgVol20).toFixed(2);

  const weightInfo = Object.entries(weights)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
    .join(', ');

  return `请深度分析以下A股数据：

## 股票基本信息
- 股票代码: ${symbol}
- 股票名称: ${name}
- 所属行业: ${basicInfo?.sector || '未知'}
- 交易所: ${symbol.startsWith('6') ? '上海证券交易所' : '深圳证券交易所'}

## 实时行情
- 当前价: ¥${quote.current_price.toFixed(2)}
- 涨跌额: ¥${quote.change.toFixed(2)}
- 涨跌幅: ${quote.change_pct.toFixed(2)}%
- 今日最高: ¥${quote.high.toFixed(2)}
- 今日最低: ¥${quote.low.toFixed(2)}
- 开盘价: ¥${quote.open.toFixed(2)}
- 昨收价: ¥${quote.prev_close.toFixed(2)}
- 成交量: ${quote.volume}
- 量比(相对20日均量): ${volRatio}

## 基本面数据
- 市盈率(PE): ${basicInfo?.pe_ratio ?? '未知'}
- 市净率(PB): ${basicInfo?.pb_ratio ?? '未知'}
- 总市值: ${basicInfo?.market_cap ? basicInfo.market_cap.toFixed(2) + '亿元' : '未知'}

## 技术指标
- RSI(14): ${indicators.rsi.toFixed(2)}
- MACD: ${indicators.macd.toFixed(4)} (信号线: ${indicators.macd_signal.toFixed(4)})
- MA5: ¥${indicators.ma5.toFixed(2)}
- MA10: ¥${indicators.ma10.toFixed(2)}
- MA20: ¥${indicators.ma20.toFixed(2)}
- MA60: ¥${indicators.ma60.toFixed(2)}
- 布林带上轨: ¥${indicators.boll_upper.toFixed(2)}
- 布林带下轨: ¥${indicators.boll_lower.toFixed(2)}

## 动量数据
- 近5日涨跌幅: ${chg5}%
- 近20日涨跌幅: ${chg20}%
- 近60日涨跌幅: ${chg60}%

## 近20日走势
${JSON.stringify(recentCandles, null, 2)}

## 当前因子权重公式
${weightInfo}

请基于以上数据, 从8个维度进行深度分析, 并进行多策略交叉印证。
注意这是中国A股市场, 涨跌幅限制为±10%(创业板±20%)。
请确保分析深入、专业, 体现真正的投资逻辑。`;
}

/** 无 API key 或 API 失败时的降级分析 (基于技术指标+基本面) */
function generateFallbackAnalysis(
  symbol: string,
  name: string,
  quote: StockQuote,
  candles: StockCandle[],
  indicators: TechnicalIndicators,
  basicInfo: {
    pe_ratio: number | null;
    pb_ratio: number | null;
    market_cap: number | null;
    sector: string | null;
  } | null | undefined,
  weights: Record<string, number>,
  formulaVersion: string
): AIAnalysisResult {
  const factorScores: Record<string, FactorScore> = {};
  const factors: string[] = [];

  // 1. 技术面
  let techScore = 50;
  if (indicators.rsi < 30) { techScore += 15; factors.push(`RSI=${indicators.rsi.toFixed(0)}超卖，存在反弹机会`); }
  else if (indicators.rsi > 70) { techScore -= 15; factors.push(`RSI=${indicators.rsi.toFixed(0)}超买，注意回调风险`); }
  else { factors.push(`RSI=${indicators.rsi.toFixed(0)}中性`); }
  if (indicators.macd > indicators.macd_signal) { techScore += 12; factors.push('MACD金叉，短期动能向上'); }
  else { techScore -= 12; factors.push('MACD死叉，短期动能向下'); }
  if (indicators.ma5 > indicators.ma20) { techScore += 10; }
  else { techScore -= 10; }
  techScore = Math.max(0, Math.min(100, techScore));
  factorScores.technical = {
    score: techScore, weight: weights.technical || 0.125,
    contribution: techScore * (weights.technical || 0.125),
    detail: `RSI=${indicators.rsi.toFixed(1)}(${indicators.rsi < 30 ? '超卖' : indicators.rsi > 70 ? '超买' : '中性'})，MACD${indicators.macd > indicators.macd_signal ? '金叉' : '死叉'}，均线${indicators.ma5 > indicators.ma20 ? '多头排列' : '空头排列'}，布林带${quote.current_price > indicators.boll_upper ? '突破上轨' : quote.current_price < indicators.boll_lower ? '跌破下轨' : '中轨附近'}`,
  };

  // 2. 基本面
  let fundScore = 50;
  if (basicInfo?.pe_ratio !== null && basicInfo?.pe_ratio !== undefined) {
    if (basicInfo.pe_ratio < 0) { fundScore -= 20; factors.push(`PE为负(${basicInfo.pe_ratio.toFixed(1)})，公司亏损`); }
    else if (basicInfo.pe_ratio < 15) { fundScore += 15; factors.push(`PE=${basicInfo.pe_ratio.toFixed(1)}估值偏低`); }
    else if (basicInfo.pe_ratio > 100) { fundScore -= 10; factors.push(`PE=${basicInfo.pe_ratio.toFixed(1)}估值偏高`); }
  }
  if (basicInfo?.pb_ratio !== null && basicInfo?.pb_ratio !== undefined) {
    if (basicInfo.pb_ratio < 1) { fundScore += 10; factors.push(`PB=${basicInfo.pb_ratio.toFixed(2)}破净`); }
    else if (basicInfo.pb_ratio > 10) { fundScore -= 8; }
  }
  fundScore = Math.max(0, Math.min(100, fundScore));
  factorScores.fundamental = {
    score: fundScore, weight: weights.fundamental || 0.125,
    contribution: fundScore * (weights.fundamental || 0.125),
    detail: `PE=${basicInfo?.pe_ratio?.toFixed(1) ?? 'N/A'}，PB=${basicInfo?.pb_ratio?.toFixed(2) ?? 'N/A'}，市值=${basicInfo?.market_cap?.toFixed(0) ?? 'N/A'}亿，${basicInfo?.sector ? '行业: ' + basicInfo.sector : ''}`,
  };

  // 3. 政策面 (无数据, 中性)
  factorScores.policy = {
    score: 50, weight: weights.policy || 0.125,
    contribution: 50 * (weights.policy || 0.125),
    detail: '政策面数据暂缺，基于行业属性中性评估。建议关注相关行业政策动态。',
  };

  // 4. 市场情绪 (基于量比)
  const avgVol20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / Math.min(20, candles.length);
  const volRatio = avgVol20 > 0 ? quote.volume / avgVol20 : 1;
  let sentimentScore = 50;
  if (volRatio > 2) { sentimentScore += 15; factors.push(`量比${volRatio.toFixed(1)}，放量明显`); }
  else if (volRatio > 1.5) { sentimentScore += 8; }
  else if (volRatio < 0.5) { sentimentScore -= 10; factors.push(`量比${volRatio.toFixed(1)}，缩量明显`); }
  sentimentScore = Math.max(0, Math.min(100, sentimentScore));
  factorScores.market_sentiment = {
    score: sentimentScore, weight: weights.market_sentiment || 0.125,
    contribution: sentimentScore * (weights.market_sentiment || 0.125),
    detail: `量比${volRatio.toFixed(2)}，${volRatio > 1.5 ? '放量' : volRatio < 0.5 ? '缩量' : '正常'}，成交额活跃度${volRatio > 1.5 ? '较高' : '一般'}`,
  };

  // 5. 行业面 (基于行业属性)
  factorScores.industry = {
    score: 50, weight: weights.industry || 0.125,
    contribution: 50 * (weights.industry || 0.125),
    detail: `${basicInfo?.sector || '未知'}行业，需结合行业景气度进一步判断`,
  };

  // 6. 财报面 (基于PE推断)
  let finScore = 50;
  if (basicInfo?.pe_ratio !== null && basicInfo?.pe_ratio !== undefined && basicInfo.pe_ratio < 0) {
    finScore = 30;
    factors.push('公司处于亏损状态，财报面承压');
  }
  factorScores.financial_report = {
    score: finScore, weight: weights.financial_report || 0.125,
    contribution: finScore * (weights.financial_report || 0.125),
    detail: basicInfo?.pe_ratio && basicInfo.pe_ratio < 0 ? 'PE为负，公司亏损，财报面偏弱' : '财报数据暂缺，中性评估',
  };

  // 7. 动量策略
  const lastClose = candles[candles.length - 1].close;
  const close20 = candles.length > 20 ? candles[candles.length - 21].close : lastClose;
  const chg20 = close20 > 0 ? ((lastClose - close20) / close20 * 100) : 0;
  let momScore = 50;
  if (chg20 > 10) { momScore += 15; factors.push(`近20日涨${chg20.toFixed(1)}%，动量强劲`); }
  else if (chg20 > 5) { momScore += 8; }
  else if (chg20 < -10) { momScore -= 15; factors.push(`近20日跌${chg20.toFixed(1)}%，动量较弱`); }
  else if (chg20 < -5) { momScore -= 8; }
  momScore = Math.max(0, Math.min(100, momScore));
  factorScores.momentum = {
    score: momScore, weight: weights.momentum || 0.125,
    contribution: momScore * (weights.momentum || 0.125),
    detail: `近20日涨跌幅${chg20.toFixed(2)}%，${chg20 > 5 ? '动量向上' : chg20 < -5 ? '动量向下' : '动量中性'}`,
  };

  // 8. 价值策略
  let valScore = 50;
  if (basicInfo?.pb_ratio !== null && basicInfo?.pb_ratio !== undefined && basicInfo.pb_ratio < 1) {
    valScore += 20; factors.push(`PB=${basicInfo.pb_ratio.toFixed(2)}破净，价值低估`);
  }
  if (basicInfo?.pe_ratio !== null && basicInfo?.pe_ratio !== undefined && basicInfo.pe_ratio > 0 && basicInfo.pe_ratio < 15) {
    valScore += 15;
  }
  valScore = Math.max(0, Math.min(100, valScore));
  factorScores.value = {
    score: valScore, weight: weights.value || 0.125,
    contribution: valScore * (weights.value || 0.125),
    detail: `估值${valScore > 60 ? '偏低，有安全边际' : valScore < 40 ? '偏高' : '合理'}`,
  };

  // 加权综合评分
  const totalScore = Object.values(factorScores).reduce((sum, f) => sum + f.contribution, 0);

  let signal: Signal;
  if (totalScore >= 70) signal = 'strong_buy';
  else if (totalScore >= 58) signal = 'buy';
  else if (totalScore >= 42) signal = 'hold';
  else if (totalScore >= 30) signal = 'sell';
  else signal = 'strong_sell';

  // 多策略交叉印证
  const strategies: StrategyResult[] = [
    {
      strategy: '技术策略',
      signal: techScore >= 60 ? 'buy' : techScore >= 40 ? 'hold' : 'sell',
      score: Math.round(techScore),
      reason: `RSI${indicators.rsi < 30 ? '超卖' : indicators.rsi > 70 ? '超买' : '中性'}，MACD${indicators.macd > indicators.macd_signal ? '金叉' : '死叉'}，均线${indicators.ma5 > indicators.ma20 ? '多头' : '空头'}`,
    },
    {
      strategy: '价值策略',
      signal: valScore >= 60 ? 'buy' : valScore >= 40 ? 'hold' : 'sell',
      score: Math.round(valScore),
      reason: `PE=${basicInfo?.pe_ratio?.toFixed(1) ?? 'N/A'}，PB=${basicInfo?.pb_ratio?.toFixed(2) ?? 'N/A'}，${valScore > 60 ? '估值偏低' : valScore < 40 ? '估值偏高' : '估值合理'}`,
    },
    {
      strategy: '动量策略',
      signal: momScore >= 60 ? 'buy' : momScore >= 40 ? 'hold' : 'sell',
      score: Math.round(momScore),
      reason: `近20日${chg20 > 0 ? '涨' : '跌'}${Math.abs(chg20).toFixed(1)}%，${momScore > 60 ? '动量向上' : momScore < 40 ? '动量向下' : '动量中性'}`,
    },
    {
      strategy: '综合策略',
      signal,
      score: Math.round(totalScore),
      reason: `8因子加权综合评分${totalScore.toFixed(1)}/100，${signal === 'strong_buy' ? '强烈买入' : signal === 'buy' ? '买入' : signal === 'hold' ? '持有' : signal === 'sell' ? '卖出' : '强烈卖出'}`,
    },
  ];

  const entryPrice = quote.current_price;
  const targetPrice = signal === 'strong_buy' || signal === 'buy'
    ? quote.current_price * 1.1
    : quote.current_price * 0.95;
  const stopLoss = quote.current_price * 0.92;

  const riskLevel: RiskLevel = Math.abs(totalScore - 50) > 25 ? 'high' : totalScore > 50 ? 'medium' : 'high';

  const signalText: Record<Signal, string> = {
    strong_buy: '强烈买入', buy: '买入', hold: '持有', sell: '卖出', strong_sell: '强烈卖出',
  };

  const analysis = `## 技术面分析

**${name}(${symbol})** 当前价格 ¥${quote.current_price.toFixed(2)}，涨跌幅 ${quote.change_pct.toFixed(2)}%。

- **RSI(14)**: ${indicators.rsi.toFixed(1)} ${indicators.rsi < 30 ? '⚠️ 超卖区域，存在技术性反弹可能' : indicators.rsi > 70 ? '⚠️ 超买区域，注意回调风险' : '中性区域'}
- **MACD**: DIF=${indicators.macd.toFixed(4)}，DEA=${indicators.macd_signal.toFixed(4)}，${indicators.macd > indicators.macd_signal ? '✅ 金叉，短期动能向上' : '❌ 死叉，短期动能向下'}
- **均线系统**: MA5=¥${indicators.ma5.toFixed(2)}，MA20=¥${indicators.ma20.toFixed(2)}，MA60=¥${indicators.ma60.toFixed(2)}，${indicators.ma5 > indicators.ma20 && indicators.ma20 > indicators.ma60 ? '✅ 多头排列' : indicators.ma5 < indicators.ma20 && indicators.ma20 < indicators.ma60 ? '❌ 空头排列' : '⚠️ 均线纠缠'}
- **布林带**: 上轨=¥${indicators.boll_upper.toFixed(2)}，下轨=¥${indicators.boll_lower.toFixed(2)}，当前价${quote.current_price > indicators.boll_upper ? '突破上轨' : quote.current_price < indicators.boll_lower ? '跌破下轨' : '在中轨附近'}

## 基本面与估值

- **市盈率(PE)**: ${basicInfo?.pe_ratio?.toFixed(1) ?? '未知'} ${basicInfo?.pe_ratio && basicInfo.pe_ratio < 0 ? '⚠️ 公司亏损' : basicInfo?.pe_ratio && basicInfo.pe_ratio < 15 ? '✅ 估值偏低' : basicInfo?.pe_ratio && basicInfo.pe_ratio > 100 ? '⚠️ 估值偏高' : ''}
- **市净率(PB)**: ${basicInfo?.pb_ratio?.toFixed(2) ?? '未知'} ${basicInfo?.pb_ratio && basicInfo.pb_ratio < 1 ? '✅ 破净，价值低估' : ''}
- **总市值**: ${basicInfo?.market_cap ? basicInfo.market_cap.toFixed(0) + '亿元' : '未知'}
- **所属行业**: ${basicInfo?.sector || '未知'}

## 政策与行业

- **行业**: ${basicInfo?.sector || '未知'}，需关注相关产业政策及监管动态
- **政策面**: 建议关注国家对该行业的扶持/限制政策方向

## 财报分析

- ${basicInfo?.pe_ratio && basicInfo.pe_ratio < 0 ? '⚠️ PE为负，公司处于亏损状态，财报面承压' : '财报数据暂缺，建议查看最新季报/年报'}
- 建议关注: 营收增长率、净利润变化、现金流状况、资产负债率

## 市场情绪与资金

- **量比**: ${volRatio.toFixed(2)}，${volRatio > 1.5 ? '放量明显，市场关注度较高' : volRatio < 0.5 ? '缩量明显，市场关注度较低' : '成交量正常'}
- **成交额**: ¥${(quote.volume * quote.current_price / 10000).toFixed(0)}万

## 多策略交叉印证

| 策略 | 信号 | 评分 | 依据 |
|------|------|------|------|
| 技术策略 | ${strategies[0].signal} | ${strategies[0].score} | ${strategies[0].reason} |
| 价值策略 | ${strategies[1].signal} | ${strategies[1].score} | ${strategies[1].reason} |
| 动量策略 | ${strategies[2].signal} | ${strategies[2].score} | ${strategies[2].reason} |
| **综合策略** | **${signal}** | **${totalScore.toFixed(1)}** | ${strategies[3].reason} |

## 综合评分与建议

### 因子权重分解
${Object.entries(factorScores).map(([k, v]) => {
  const labels: Record<string, string> = { technical: '技术面', fundamental: '基本面', policy: '政策面', market_sentiment: '市场情绪', industry: '行业面', financial_report: '财报面', momentum: '动量', value: '价值' };
  return `- ${labels[k] || k}: 评分${v.score.toFixed(0)} × 权重${(v.weight * 100).toFixed(1)}% = 贡献${v.contribution.toFixed(2)}`;
}).join('\n')}

**加权综合评分: ${totalScore.toFixed(1)}/100 → 信号: ${signalText[signal]}**

### 操作建议
- 建议买入价: ¥${entryPrice?.toFixed(2)}
- 目标价: ¥${targetPrice?.toFixed(2)}
- 止损价: ¥${stopLoss?.toFixed(2)}

## 风险提示
本分析基于技术指标和有限的基本面数据，不构成投资建议。股市有风险，投资需谨慎。建议结合更多信息源综合判断。`;

  return {
    signal,
    confidence: Math.round(totalScore),
    entry_price: entryPrice,
    target_price: targetPrice,
    stop_loss: stopLoss,
    analysis,
    summary: `${name}综合评分${totalScore.toFixed(0)}分，${signalText[signal]}。${factors.slice(0, 2).join('；')}`,
    key_factors: factors.slice(0, 4),
    risk_level: riskLevel,
    factor_scores: factorScores,
    strategies,
    formula_version: formulaVersion,
  };
}
