import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface FeedbackBody {
  rating: number;
  helpful_factors?: string[];
  missing_factors?: string[];
  comment?: string;
}

/** 用户对 AI 分析结果进行反馈打分, 并据此调整因子权重 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: '缺少股票代码' },
        { status: 400 }
      );
    }

    // 从 Authorization header 验证用户, 获取 userId
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // 解析请求体
    const body = (await request.json()) as FeedbackBody;
    const { rating, helpful_factors, missing_factors, comment } = body;

    // 校验 rating: 1-5 的整数
    if (
      typeof rating !== 'number' ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { error: 'rating 必须为 1-5 的整数' },
        { status: 400 }
      );
    }

    const serverClient = createServerClient();

    // 1. 查询该 symbol 的最新 AI 分析记录 (按 symbol 查最新的)
    const { data: analysisRecord, error: analysisError } = await serverClient
      .from('stock_ai_analysis')
      .select('id, symbol')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (analysisError || !analysisRecord) {
      return NextResponse.json(
        { error: '该股票暂无AI分析，无法反馈' },
        { status: 400 }
      );
    }

    const analysisId = analysisRecord.id;

    // 2. 查询所有启用的因子 (用于计算权重调整)
    const { data: factors, error: factorsError } = await serverClient
      .from('analysis_factors')
      .select('id, factor_key, weight, adjustment_count')
      .eq('is_active', true);

    if (factorsError || !factors) {
      return NextResponse.json(
        { error: '获取因子权重失败', detail: factorsError?.message },
        { status: 500 }
      );
    }

    const helpfulSet = new Set(helpful_factors || []);
    const missingSet = new Set(missing_factors || []);

    // 3. 根据用户评分计算权重调整
    //    rating >= 4 (有用): helpful_factors +0.02, missing_factors +0.01
    //    rating <= 2 (没用): 所有因子 -0.01, helpful_factors 不变
    //    rating == 3 (一般): 不调整
    const weightAdjustments: Record<string, number> = {};

    for (const factor of factors) {
      const key = factor.factor_key;
      let adjustment = 0;

      if (rating >= 4) {
        // 有用: 用户选的 helpful_factors 权重 +0.02, missing_factors 权重 +0.01
        if (helpfulSet.has(key)) {
          adjustment += 0.02;
        }
        if (missingSet.has(key)) {
          adjustment += 0.01;
        }
      } else if (rating <= 2) {
        // 没用: 所有因子权重 -0.01, helpful_factors 权重不变
        if (!helpfulSet.has(key)) {
          adjustment = -0.01;
        }
      }
      // rating == 3: 不调整, adjustment 保持 0

      weightAdjustments[key] = adjustment;
    }

    // 4. 检查用户是否已反馈过 (analysis_id + user_id 唯一)
    const { data: existingFeedback } = await serverClient
      .from('analysis_feedback')
      .select('id')
      .eq('analysis_id', analysisId)
      .eq('user_id', userId)
      .maybeSingle();

    // 5. 将 weight_adjustments 存入 analysis_feedback 表 (先存 applied=false)
    const feedbackPayload = {
      analysis_id: analysisId,
      user_id: userId,
      rating,
      helpful_factors: helpful_factors || null,
      missing_factors: missing_factors || null,
      comment: comment || null,
      weight_adjustments: weightAdjustments,
      applied: false,
    };

    let feedbackId: string;

    if (existingFeedback) {
      // 已反馈过则 upsert 更新
      const { data: updated } = await serverClient
        .from('analysis_feedback')
        .update(feedbackPayload)
        .eq('id', existingFeedback.id)
        .select('id')
        .single();
      feedbackId = updated?.id || existingFeedback.id;
    } else {
      const { data: inserted } = await serverClient
        .from('analysis_feedback')
        .insert(feedbackPayload)
        .select('id')
        .single();
      feedbackId = inserted?.id;
    }

    // 6. 如果 rating >= 4 或 <= 2, 应用权重调整到 analysis_factors 表
    const shouldApply = rating >= 4 || rating <= 2;
    let applied = false;

    if (shouldApply && feedbackId) {
      // 计算调整后的新权重
      const updatedFactors: {
        id: string;
        new_weight: number;
        adjustment_count: number;
      }[] = [];

      let totalWeight = 0;

      for (const factor of factors) {
        const key = factor.factor_key;
        const adjustment = weightAdjustments[key] || 0;
        let newWeight = factor.weight + adjustment;
        // 权重下限保护, 避免负数或过小
        if (newWeight < 0.01) newWeight = 0.01;
        updatedFactors.push({
          id: factor.id,
          new_weight: newWeight,
          adjustment_count: factor.adjustment_count + 1,
        });
        totalWeight += newWeight;
      }

      // 归一化: 确保所有权重之和 = 1.0
      if (totalWeight > 0) {
        for (const f of updatedFactors) {
          f.new_weight =
            Math.round((f.new_weight / totalWeight) * 10000) / 10000;
        }
      }

      // 更新 analysis_factors 表
      for (const f of updatedFactors) {
        await serverClient
          .from('analysis_factors')
          .update({
            weight: f.new_weight,
            adjustment_count: f.adjustment_count,
            updated_at: new Date().toISOString(),
          })
          .eq('id', f.id);
      }

      applied = true;

      // 7. 标记 feedback 的 applied = true
      await serverClient
        .from('analysis_feedback')
        .update({ applied: true })
        .eq('id', feedbackId);
    }

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      message: '反馈已记录',
      weight_adjustments: weightAdjustments,
      applied,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
