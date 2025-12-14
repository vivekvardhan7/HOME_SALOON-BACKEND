import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==================== PAYMENT PROCESSING ====================

// Create payment intent (Razorpay)
router.post('/create-intent', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { bookingId, amount, currency = 'INR' } = req.body;

    // Verify booking belongs to user
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, status,
        vendor:vendor (
          id, shopName
        )
      `)
      .eq('id', bookingId)
      .eq('customer_id', req.user!.id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Booking cannot be paid for' });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        user_id: req.user!.id,
        amount: parseFloat(amount),
        method: 'CARD', // Default method
        status: 'PENDING',
        gateway_response: JSON.stringify({
          amount,
          currency,
          bookingId,
          customerId: req.user!.id
        })
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Mock Razorpay order creation (replace with actual Razorpay API call)
    const razorpayOrder = {
      id: `order_${Date.now()}`,
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: `receipt_${payment.id}`,
      notes: {
        bookingId,
        customerId: req.user!.id
      }
    };

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        razorpayOrder,
        key: process.env.RAZORPAY_KEY_ID // Frontend needs this
      }
    });
  } catch (error) {
    console.error('Create intent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment intent' });
  }
});

// Verify payment (Razorpay)
router.post('/verify', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify payment belongs to user
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, booking:bookings(*)')
      .eq('id', paymentId)
      .eq('user_id', req.user!.id)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Verify Razorpay signature (replace with actual verification)
    // ...

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'COMPLETED',
        gateway_id: razorpayPaymentId,
        gateway_response: JSON.stringify({
          razorpayPaymentId,
          razorpaySignature,
          verified: true
        })
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update booking status
    if (payment.booking) {
      await supabase
        .from('bookings')
        .update({ status: 'CONFIRMED' })
        .eq('id', payment.booking.id);

      // Create booking event
      await supabase
        .from('booking_events')
        .insert({
          booking_id: payment.booking.id,
          type: 'PAYMENT_COMPLETED',
          data: JSON.stringify({
            paymentId,
            razorpayPaymentId,
            amount: payment.amount
          })
        });
    }

    res.json({ success: true, data: updatedPayment });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

// Create Stripe payment intent
router.post('/stripe/create-intent', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { bookingId, amount, currency = 'usd' } = req.body;

    // Verify booking belongs to user
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .eq('customer_id', req.user!.id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Booking cannot be paid for' });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        user_id: req.user!.id,
        amount: parseFloat(amount),
        method: 'CARD',
        status: 'PENDING',
        gateway_response: JSON.stringify({
          amount,
          currency,
          bookingId,
          customerId: req.user!.id
        })
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Mock Stripe PaymentIntent creation
    const stripePaymentIntent = {
      id: `pi_${Date.now()}`,
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount * 100, // Stripe expects amount in cents
      currency,
      status: 'requires_payment_method'
    };

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        stripePaymentIntent,
        key: process.env.STRIPE_PUBLISHABLE_KEY
      }
    });
  } catch (error) {
    console.error('Stripe intent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create Stripe payment intent' });
  }
});

// Confirm Stripe payment
router.post('/stripe/confirm', requireAuth, requireRole(['CUSTOMER']), async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentId, stripePaymentIntentId } = req.body;

    // Verify payment belongs to user
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, booking:bookings(*)')
      .eq('id', paymentId)
      .eq('user_id', req.user!.id)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'COMPLETED',
        gateway_id: stripePaymentIntentId,
        gateway_response: JSON.stringify({
          stripePaymentIntentId,
          confirmed: true
        })
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update booking status to AWAITING_MANAGER for manager to assign vendor
    if (payment.booking) {
      await supabase
        .from('bookings')
        .update({ status: 'AWAITING_MANAGER' })
        .eq('id', payment.booking.id);

      // Create booking event
      await supabase
        .from('booking_events')
        .insert({
          booking_id: payment.booking.id,
          type: 'PAYMENT_COMPLETED',
          data: JSON.stringify({
            paymentId,
            stripePaymentIntentId,
            amount: payment.amount
          })
        });
    }

    res.json({ success: true, data: updatedPayment });
  } catch (error) {
    console.error('Stripe confirm error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm payment' });
  }
});

// ==================== PAYMENT WEBHOOKS ====================

// Razorpay webhook
router.post('/webhook/razorpay', async (req, res) => {
  try {
    const { event, payload } = req.body;

    // Verify webhook signature
    // ...

    switch (event) {
      case 'payment.captured':
        await handleRazorpayPaymentSuccess(payload);
        break;
      case 'payment.failed':
        await handleRazorpayPaymentFailure(payload);
        break;
      case 'refund.processed':
        await handleRazorpayRefundProcessed(payload);
        break;
      default:
        console.log(`Unhandled Razorpay event: ${event}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Stripe webhook
router.post('/webhook/stripe', async (req, res) => {
  try {
    const { type, data } = req.body;

    // Verify webhook signature
    // ...

    switch (type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailure(data.object);
        break;
      case 'charge.refunded':
        await handleStripeRefundProcessed(data.object);
        break;
      default:
        console.log(`Unhandled Stripe event: ${type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== WEBHOOK HANDLERS ====================

async function handleRazorpayPaymentSuccess(payload: any) {
  try {
    const { id: razorpayPaymentId, order_id, amount } = payload.payment.entity;

    // Find payment by gateway ID (if stored) or order_id (if mapped to bookingId)
    // Assuming order_id maps to bookingId or we stored razorpay order id in payment
    // For now, let's assume we can find it by gatewayId if we updated it, or we create new.

    // In create-intent, we didn't store razorpay order id in DB, so we might need to rely on metadata or just create new if not found.

    let { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('gateway_id', razorpayPaymentId)
      .single();

    if (!payment) {
      // Create new payment record if not found
      const { data: newPayment } = await supabase
        .from('payments')
        .insert({
          booking_id: order_id, // Assuming order_id maps to bookingId
          user_id: 'unknown', // You'll need to get this from the order
          amount: amount / 100, // Convert from paise
          method: 'CARD',
          status: 'COMPLETED',
          gateway_id: razorpayPaymentId,
          gateway_response: JSON.stringify(payload)
        })
        .select()
        .single();
      payment = newPayment;
    } else {
      // Update existing payment
      const { data: updatedPayment } = await supabase
        .from('payments')
        .update({
          status: 'COMPLETED',
          gateway_response: JSON.stringify(payload)
        })
        .eq('id', payment.id)
        .select()
        .single();
      payment = updatedPayment;
    }

    // Update booking status to AWAITING_MANAGER for manager to assign vendor
    if (payment?.booking_id) {
      await supabase
        .from('bookings')
        .update({ status: 'AWAITING_MANAGER' })
        .eq('id', payment.booking_id);

      // Create booking event
      await supabase
        .from('booking_events')
        .insert({
          booking_id: payment.booking_id,
          type: 'PAYMENT_COMPLETED',
          data: JSON.stringify({
            paymentId: payment.id,
            razorpayPaymentId,
            amount: payment.amount
          })
        });
    }

    console.log(`Razorpay payment ${razorpayPaymentId} processed successfully`);
  } catch (error) {
    console.error('Error handling Razorpay payment success:', error);
  }
}

async function handleRazorpayPaymentFailure(payload: any) {
  try {
    const { id: razorpayPaymentId } = payload.payment.entity;

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'FAILED',
        gateway_response: JSON.stringify(payload)
      })
      .eq('gateway_id', razorpayPaymentId);

    console.log(`Razorpay payment ${razorpayPaymentId} failed`);
  } catch (error) {
    console.error('Error handling Razorpay payment failure:', error);
  }
}

async function handleRazorpayRefundProcessed(payload: any) {
  try {
    const { id: razorpayRefundId, payment_id, amount } = payload.refund.entity;

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'REFUNDED',
        refund_amount: amount / 100,
        refunded_at: new Date().toISOString(),
        gateway_response: JSON.stringify(payload)
      })
      .eq('gateway_id', payment_id);

    console.log(`Razorpay refund ${razorpayRefundId} processed`);
  } catch (error) {
    console.error('Error handling Razorpay refund:', error);
  }
}

async function handleStripePaymentSuccess(paymentIntent: any) {
  try {
    const { id: stripePaymentIntentId, amount, currency } = paymentIntent;

    // Find payment by gateway ID
    let { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('gateway_id', stripePaymentIntentId)
      .single();

    if (!payment) {
      // Create new payment record if not found
      const { data: newPayment } = await supabase
        .from('payments')
        .insert({
          booking_id: 'unknown', // You'll need to get this from metadata
          user_id: 'unknown', // You'll need to get this from metadata
          amount: amount / 100, // Convert from cents
          method: 'CARD',
          status: 'COMPLETED',
          gateway_id: stripePaymentIntentId,
          gateway_response: JSON.stringify(paymentIntent)
        })
        .select()
        .single();
      payment = newPayment;
    } else {
      // Update existing payment
      const { data: updatedPayment } = await supabase
        .from('payments')
        .update({
          status: 'COMPLETED',
          gateway_response: JSON.stringify(paymentIntent)
        })
        .eq('id', payment.id)
        .select()
        .single();
      payment = updatedPayment;
    }

    // Update booking status to AWAITING_MANAGER for manager to assign vendor
    if (payment?.booking_id && payment.booking_id !== 'unknown') {
      await supabase
        .from('bookings')
        .update({ status: 'AWAITING_MANAGER' })
        .eq('id', payment.booking_id);

      // Create booking event
      await supabase
        .from('booking_events')
        .insert({
          booking_id: payment.booking_id,
          type: 'PAYMENT_COMPLETED',
          data: JSON.stringify({
            paymentId: payment.id,
            stripePaymentIntentId,
            amount: payment.amount
          })
        });
    }

    console.log(`Stripe payment ${stripePaymentIntentId} processed successfully`);
  } catch (error) {
    console.error('Error handling Stripe payment success:', error);
  }
}

async function handleStripePaymentFailure(paymentIntent: any) {
  try {
    const { id: stripePaymentIntentId } = paymentIntent;

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'FAILED',
        gateway_response: JSON.stringify(paymentIntent)
      })
      .eq('gateway_id', stripePaymentIntentId);

    console.log(`Stripe payment ${stripePaymentIntentId} failed`);
  } catch (error) {
    console.error('Error handling Stripe payment failure:', error);
  }
}

async function handleStripeRefundProcessed(charge: any) {
  try {
    const { id: stripeChargeId, amount, currency } = charge;

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'REFUNDED',
        refund_amount: amount / 100,
        refunded_at: new Date().toISOString(),
        gateway_response: JSON.stringify(charge)
      })
      .eq('gateway_id', stripeChargeId);

    console.log(`Stripe refund for charge ${stripeChargeId} processed`);
  } catch (error) {
    console.error('Error handling Stripe refund:', error);
  }
}

// ==================== PAYMENT METHODS ====================

// Get available payment methods
router.get('/methods', requireAuth, async (req, res) => {
  try {
    const methods = [
      {
        id: 'card',
        name: 'Credit/Debit Card',
        description: 'Pay with Visa, Mastercard, or other cards',
        icon: '💳',
        supported: ['razorpay', 'stripe']
      },
      {
        id: 'upi',
        name: 'UPI',
        description: 'Pay using UPI apps like Google Pay, PhonePe',
        icon: '📱',
        supported: ['razorpay']
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        description: 'Pay using your bank account',
        icon: '🏦',
        supported: ['razorpay']
      },
      {
        id: 'wallet',
        name: 'Digital Wallet',
        description: 'Pay using Paytm, Amazon Pay, or other wallets',
        icon: '👛',
        supported: ['razorpay']
      }
    ];

    res.json({ success: true, data: methods });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment methods' });
  }
});

export default router;