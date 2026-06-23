import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/** 获取 Stripe 实例 (服务端) */
export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2025-06-30.basil' as Stripe.LatestApiVersion,
  });
  return stripeInstance;
}

/** 创建或获取 Stripe Customer */
export async function getOrCreateCustomer(email: string, userId: string): Promise<string> {
  const stripe = getStripe();

  // 先查找已有 customer
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // 创建新 customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  return customer.id;
}

/** 创建 Checkout Session */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
}) {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      supabase_user_id: params.userId,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: params.userId,
      },
    },
  });

  return session;
}

/** 创建 Customer Portal Session (管理订阅) */
export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

/** 处理 Stripe Webhook */
export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
