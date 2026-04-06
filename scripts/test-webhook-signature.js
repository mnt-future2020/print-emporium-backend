
import crypto from 'crypto';

const secret = '12345678';
const payload = {
  entity: 'event',
  event: 'order.paid',
  contains: ['payment', 'order'],
  payload: {
    payment: {
      entity: {
        id: 'pay_123',
        amount: 50000,
      }
    }
  }
};

// Simulate what Razorpay would send
const rawBody = JSON.stringify(payload);
const expectedSignature = crypto.createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');

console.log('Generated Signature:', expectedSignature);

// Simulate what Controller does
const receivedBody = JSON.parse(rawBody); // Express parses it
const controllerSignature = crypto.createHmac('sha256', secret)
  .update(JSON.stringify(receivedBody))
  .digest('hex');

console.log('Controller Signature:', controllerSignature);

if (expectedSignature === controllerSignature) {
  console.log('✅ Signature Match!');
} else {
  console.log('❌ Signature Mismatch!');
  console.log('This confirms JSON.stringify depends on key order and might be brittle.');
}
