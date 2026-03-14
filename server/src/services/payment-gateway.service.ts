import { AppError } from '../middleware/error-handler.js';

// Stripe placeholder
export async function createStripeCheckoutSession(_apartmentId: string, _amount: number, _currency: string): Promise<{ url: string }> {
  throw new AppError(501, 'Stripe integration not yet implemented');
}

export async function handleStripeWebhook(_payload: Buffer, _signature: string): Promise<void> {
  throw new AppError(501, 'Stripe webhook handler not yet implemented');
}

// CardCom placeholder
export async function createCardcomPaymentPage(_apartmentId: string, _amount: number): Promise<{ url: string }> {
  throw new AppError(501, 'CardCom integration not yet implemented');
}

export async function handleCardcomCallback(_data: Record<string, string>): Promise<void> {
  throw new AppError(501, 'CardCom callback handler not yet implemented');
}
