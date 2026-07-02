import type { StockQuote, StockCandle, TechnicalIndicators, StockSearchResult } from '@/types';

// ========== 东方财富 API (免费, 无需 API Key) ==========
const EASTMONEY_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const EASTMONEY_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const EASTMONEY_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get';
const EASTMONEY_BASIC_URL = 'https://push2.eastmoney.com/api/qt/stock/get';

/**
 * 获取东方财富 secid (市场代码.股票代码)
 * 沪市: 6开头 → 1.xxx, 9开头 → 1.xxx
 * 深市: 0开头 → 0.xxx, 3开头 → 0.xxx, 2开头 → 0.xxx
 * 北交所: 8开头 → 0.xxx, 4开头 → 0.xxx
 */
function getSecId(symbol: string): string {
  const code = symbol.replace(/\D/g, '');
  if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
    return `1.${code}`;
  }
  return `0.${code}`;
}

/** 带超时的 fetch 封装 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 获取股票实时报价 (带重试) */
export async function getQuote(symbol: string): Promise<StockQuote | null> {
  // 最多重试3次
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const secid = getSecId(symbol);
      const url = `${EASTMONEY_QUOTE_URL}?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f59,f60,f170`;

      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://quote.eastmoney.com/',
        },
      }, 6000);
      if (!res.ok) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        return null;
      }
      const json = await res.json();
      const data = json?.data;
      // data 存在且 f57(代码) 存在即为有效数据 (f43 可能为 0 表示停牌或未开盘)
      if (!data || !data.f57) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        return null;
      }

      // 东方财富返回的价格需要根据 f59(小数位数) 进行换算
      const decimal = data.f59 || 2;
      const divisor = Math.pow(10, decimal);

      const current = data.f43 / divisor;
      const prevClose = data.f60 / divisor;
      const change = current - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: data.f57 || symbol,
        name: data.f58 || symbol,
        current_price: current,
        change,
        change_pct: changePct,
        high: data.f44 / divisor,
        low: data.f45 / divisor,
        open: data.f46 / divisor,
        prev_close: prevClose,
        volume: data.f47 || 0,
      };
    } catch {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
      return null;
    }
  }
  return null;
}

/** 获取公司信息 (东方财富不提供单独的公司信息接口, 返回基本信息) */
export async function getCompanyProfile(symbol: string) {
  try {
    const quote = await getQuote(symbol);
    if (!quote) return null;

    return {
      name: quote.name,
      exchange: symbol.startsWith('6') ? 'SH' : 'SZ',
      sector: null,
      marketCap: null,
      logo: null,
      country: 'CN',
    };
  } catch {
    return null;
  }
}

/**
 * 搜索股票 (东方财富搜索API)
 * 支持代码、名称、拼音搜索
 */
export async function searchStocks(keyword: string, limit: number = 10): Promise<StockSearchResult[]> {
  if (!keyword || keyword.trim().length < 1) return [];

  try {
    const url = `${EASTMONEY_SEARCH_URL}?input=${encodeURIComponent(keyword.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E329E8&count=${limit}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list: any[] = json?.QuotationCodeTable?.Data;
    if (!list || !Array.isArray(list)) return [];

    return list
      .filter((item) => {
        // 只返回 A 股 (沪市/深市/北交所)
        const code = item.Code || '';
        return /^\d{6}$/.test(code);
      })
      .map((item) => ({
        symbol: item.Code,
        name: item.Name,
        exchange: item.MktNum === '0' ? 'SZ' : item.MktNum === '1' ? 'SH' : 'BJ',
        pinyin: item.Pinyin || undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * 获取股票基本面数据 (市盈率、市净率、总市值等)
 * 东方财富实时行情接口包含这些字段
 */
export async function getBasicInfo(symbol: string): Promise<{
  name: string;
  exchange: string;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
} | null> {
  try {
    const secid = getSecId(symbol);
    // f57=代码 f58=名称 f59=小数位 f84=总市值 f85=流通市值 f162=市盈率 f167=市净率 f127=行业
    const url = `${EASTMONEY_BASIC_URL}?secid=${secid}&fields=f57,f58,f59,f84,f85,f162,f167,f127`;

    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || !data.f57) return null;

    const decimal = data.f59 || 2;
    const divisor = Math.pow(10, decimal);

    return {
      name: data.f58 || symbol,
      exchange: symbol.startsWith('6') ? 'SH' : symbol.startsWith('8') || symbol.startsWith('4') ? 'BJ' : 'SZ',
      sector: data.f127 || null,
      // f84 总市值, 单位是元, 转换为亿元
      market_cap: data.f84 ? data.f84 / 1e8 : null,
      // f162 市盈率(动态)
      pe_ratio: data.f162 ? data.f162 / divisor : null,
      // f167 市净率
      pb_ratio: data.f167 ? data.f167 / divisor : null,
    };
  } catch {
    return null;
  }
}

/** 生成东方财富网页链接 */
export function getEastmoneyUrl(symbol: string): string {
  const exchange = symbol.startsWith('6') ? 'sh' : 'sz';
  return `https://quote.eastmoney.com/${exchange}${symbol}.html`;
}

/** 生成雪球网页链接 */
export function getXueqiuUrl(symbol: string): string {
  const exchange = symbol.startsWith('6') ? 'SH' : 'SZ';
  return `https://xueqiu.com/S/${exchange}${symbol}`;
}

/** 生成同花顺网页链接 */
export function get10jqkaUrl(symbol: string): string {
  const exchange = symbol.startsWith('6') ? 'sh' : 'sz';
  return `https://stockpage.10jqka.com.cn/${exchange}${symbol}/`;
}

/** 获取历史 K 线数据 */
export async function getCandles(
  symbol: string,
  resolution: 'D' | 'W' | 'M' = 'D'
): Promise<StockCandle[]> {
  try {
    const secid = getSecId(symbol);
    // klt: 101=日K, 102=周K, 103=月K
    const klt = resolution === 'D' ? '101' : resolution === 'W' ? '102' : '103';

    // 东方财富 API 必须带 beg 和 end 参数, 否则返回空数据
    const now = new Date();
    const end = `${now.getFullYear()}1231`;
    const begYear = now.getFullYear() - 1;
    const beg = `${begYear}0101`;

    const url = `${EASTMONEY_KLINE_URL}?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=${klt}&fqt=1&lmt=120&beg=${beg}&end=${end}`;

    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const klines: string[] = json?.data?.klines;
    if (!klines || !Array.isArray(klines)) return [];

    // klines 格式: "date,open,close,high,low,volume,amount"
    const candles: StockCandle[] = klines.map((line) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5]) || 0,
      };
    });

    return candles;
  } catch {
    return [];
  }
}

/** 批量获取报价 */
export async function getBatchQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();
  const promises = symbols.map(async (sym) => {
    const quote = await getQuote(sym);
    if (quote) results.set(sym, quote);
  });
  await Promise.all(promises);
  return results;
}

// ========== 技术指标计算 ==========

/** 计算 RSI (相对强弱指数) */
export function calculateRSI(candles: StockCandle[], period: number = 14): number {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** 计算 MACD */
export function calculateMACD(candles: StockCandle[]) {
  const closes = candles.map(c => c.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA(
    closes.slice(-35).map((_, i) => {
      const start = closes.length - 35 + i;
      return calculateEMA(closes.slice(0, start + 1), 12) - calculateEMA(closes.slice(0, start + 1), 26);
    }),
    9
  );

  return { macd, signal: isNaN(signal) ? macd : signal };
}

/** 计算 EMA (指数移动平均) */
function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values[values.length - 1];

  const k = 2 / (period + 1);
  let ema = values[0];

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return ema;
}

/** 计算简单移动平均线 */
function calculateSMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** 计算布林带 */
function calculateBollingerBands(candles: StockCandle[], period: number = 20) {
  const closes = candles.map(c => c.close);
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last };
  }

  const slice = closes.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - ma) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: ma + 2 * std,
    middle: ma,
    lower: ma - 2 * std,
  };
}

/** 计算所有技术指标 */
export function calculateIndicators(candles: StockCandle[]): TechnicalIndicators {
  const closes = candles.map(c => c.close);
  const boll = calculateBollingerBands(candles);
  const macd = calculateMACD(candles);

  return {
    rsi: calculateRSI(candles),
    macd: macd.macd,
    macd_signal: macd.signal,
    ma5: calculateSMA(closes, 5),
    ma10: calculateSMA(closes, 10),
    ma20: calculateSMA(closes, 20),
    ma60: calculateSMA(closes, 60),
    boll_upper: boll.upper,
    boll_lower: boll.lower,
  };
}

/** 根据技术指标生成信号 */
export function generateSignalFromIndicators(indicators: TechnicalIndicators): {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
} {
  let score = 50;

  // RSI 分析
  if (indicators.rsi < 30) score += 15;       // 超卖
  else if (indicators.rsi < 40) score += 8;
  else if (indicators.rsi > 70) score -= 15;  // 超买
  else if (indicators.rsi > 60) score -= 8;

  // MACD 分析
  if (indicators.macd > indicators.macd_signal) score += 12;
  else score -= 12;

  // 均线分析 (短期均线在长期均线之上 = 多头)
  if (indicators.ma5 > indicators.ma20) score += 10;
  else score -= 10;

  if (indicators.ma10 > indicators.ma60) score += 8;
  else score -= 8;

  // 限制范围
  score = Math.max(0, Math.min(100, score));

  let signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  if (score >= 75) signal = 'strong_buy';
  else if (score >= 60) signal = 'buy';
  else if (score >= 40) signal = 'hold';
  else if (score >= 25) signal = 'sell';
  else signal = 'strong_sell';

  return { signal, confidence: score };
}

/** 默认关注的 A 股股票池 */
export const DEFAULT_WATCHLIST: { symbol: string; name: string }[] = [
  // 白酒
  { symbol: '600519', name: '贵州茅台' },
  { symbol: '000858', name: '五粮液' },
  // 银行/金融
  { symbol: '600036', name: '招商银行' },
  { symbol: '601318', name: '中国平安' },
  { symbol: '601398', name: '工商银行' },
  { symbol: '000001', name: '平安银行' },
  // 新能源
  { symbol: '300750', name: '宁德时代' },
  { symbol: '002594', name: '比亚迪' },
  { symbol: '601012', name: '隆基绿能' },
  // 科技
  { symbol: '300059', name: '东方财富' },
  { symbol: '002415', name: '海康威视' },
  { symbol: '000063', name: '中兴通讯' },
  { symbol: '002230', name: '科大讯飞' },
  // 消费/医药
  { symbol: '600276', name: '恒瑞医药' },
  { symbol: '000333', name: '美的集团' },
  { symbol: '600887', name: '伊利股份' },
  // 半导体
  { symbol: '688981', name: '中芯国际' },
  { symbol: '002049', name: '紫光国微' },
  // 军工
  { symbol: '600893', name: '航发动力' },
  // 汽车
  { symbol: '601633', name: '长城汽车' },
  // 其他
  { symbol: '600000', name: '浦发银行' },
  { symbol: '601166', name: '兴业银行' },
  { symbol: '002714', name: '牧原股份' },
  { symbol: '600031', name: '三一重工' },
  { symbol: '601888', name: '中国中免' },
];
