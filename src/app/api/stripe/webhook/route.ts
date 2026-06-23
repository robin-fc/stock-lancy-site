import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getStripe, constructWebhookEvent } from '@/lib/stripe';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 处理 Stripe Webhook */
export async function POST(request: NextRequest) {
  try {
    // 读取原始 body (不能用 request.json(), 必须用 request.text())
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: '缺少 Stripe 签名' },
        { status: 400 }
      );
    }

    // 验证 webhook 签名并构造事件
    let event: Stripe.Event;
    try {
      event = await constructWebhookEvent(payload, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : '签名验证失败';
      return NextResponse.json(
        { error: `Webhook 签名验证失败: ${message}` },
        { status: 400 }
      );
    }

    const serverClient = createServerClient();
    const stripe = getStripe();

    // 根据事件类型处理
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(serverClient, stripe, event);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(serverClient, stripe, event);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(serverClient, stripe, event);
        break;
      }

      default:
        // 忽略其他事件
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/** 处理 checkout.session.completed 事件 */
async function handleCheckoutCompleted(
  serverClient: ReturnType<typeof createServerClient>,
  stripe: Stripe,
  event: Stripe.Event
) {
  const session = event.data.object as Stripe.Checkout.Session;

  // 从 metadata 获取用户 ID
  const userId = session.metadata?.supabase_user_id;
  if (!userId) return;

  // 获取订阅详情
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // 确定订阅计划
  const subItem = subscription.items.data[0];
  const priceId = subItem?.price?.id;
  const interval = subItem?.price?.recurring?.interval;
  const isPro = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = subItem?.current_period_end;
  const periodStart = subItem?.current_period_start;

  // 更新 profile
  await serverClient
    .from('profiles')
    .update({
      plan: isPro ? 'pro' : 'free',
      stripe_customer_id: session.customer as string,
      membership_expires_at: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq('id', userId);

  // 插入/更新订阅记录
  await serverClient
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId || null,
        stripe_customer_id: session.customer as string,
        status: subscription.status,
        plan: isPro ? 'pro' : 'free',
        interval: (interval as 'month' | 'year') || null,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: 'stripe_subscription_id' }
    );
}

/** 处理 customer.subscription.updated 事件 */
async function handleSubscriptionUpdated(
  serverClient: ReturnType<typeof createServerClient>,
  stripe: Stripe,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription;

  // 从 metadata 获取用户 ID, 或通过 customer 查找
  let userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    // 通过 customer_id 查找用户
    const { data: profile } = await serverClient
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();
    userId = profile?.id;
  }

  if (!userId) return;

  const subItem = subscription.items.data[0];
  const priceId = subItem?.price?.id;
  const interval = subItem?.price?.recurring?.interval;
  const isPro = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = subItem?.current_period_end;
  const periodStart = subItem?.current_period_start;

  // 更新 profile
  await serverClient
    .from('profiles')
    .update({
      plan: isPro ? 'pro' : 'free',
      membership_expires_at: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq('id', userId);

  // 更新订阅记录
  await serverClient
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId || null,
        stripe_customer_id: subscription.customer as string,
        status: subscription.status,
        plan: isPro ? 'pro' : 'free',
        interval: (interval as 'month' | 'year') || null,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: 'stripe_subscription_id' }
    );
}

/** 处理 customer.subscription.deleted 事件 */
async function handleSubscriptionDeleted(
  serverClient: ReturnType<typeof createServerClient>,
  _stripe: Stripe,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription;

  // 从 metadata 获取用户 ID, 或通过 customer 查找
  let userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    const { data: profile } = await serverClient
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();
    userId = profile?.id;
  }

  if (!userId) return;

  // 将用户降级为免费版
  await serverClient
    .from('profiles')
    .update({
      plan: 'free',
      membership_expires_at: null,
    })
    .eq('id', userId);

  // 更新订阅记录状态为 canceled
  await serverClient
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan: 'free',
      cancel_at_period_end: false,
    })
    .eq('stripe_subscription_id', subscription.id);
}
