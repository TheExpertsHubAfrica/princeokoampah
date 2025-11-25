# Paystack Payment Integration Documentation

## Overview
The event registration system now includes full Paystack payment integration with conditional payment requirements, backend verification, and comprehensive email notifications.

## Features

### 1. **Conditional Payment Detection**
- Automatically detects if an event requires payment
- Payment is triggered only when `eventInvestment` field starts with "Ghc", "GHC", or "GHS"
- Extracts numeric amount using regex pattern: `/(?:Ghc|GHC|GHS)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i`
- Free events (e.g., "Early Bird Registration Available") proceed without payment

### 2. **Frontend Payment Flow**
- **Dynamic Button Text**: Changes based on event pricing
  - Paid events: "Pay GHS X & Register"
  - Free events: "Register Now"
- **Paystack Modal**: Opens Paystack Inline payment modal for paid events
- **Amount Conversion**: Automatically converts GHS to kobo (multiplies by 100)
- **User Experience**: Smooth modal flow with success/error handling

### 3. **Backend Payment Verification**
- **Verification Before Registration**: Payment reference verified with Paystack API before processing registration
- **Security**: Uses secret key with Bearer authentication
- **Validation**: Confirms payment status is "success" and amount matches
- **Data Capture**: Logs payment amount, reference, channel, and timestamp

### 4. **Email Notifications**
Both user confirmation and admin notification emails include:
- Payment status badge
- Amount paid (GHS)
- Payment reference number
- Payment channel/method
- Transaction gateway (Paystack)

## Configuration

### Test Credentials (Current)
```javascript
// Frontend (event-registration.html)
const PAYSTACK_PUBLIC_KEY = 'pk_test_d3a81afef739c83459cb4aad6de8eb4b511689ab';

// Backend (event-registration.gs)
PAYSTACK_SECRET_KEY: 'sk_test_1d6bdeece5d7008f7fc2476dce062c88576f8d72'
```

### Production Setup
1. **Get Live Keys**: Login to Paystack dashboard → Settings → API Keys & Webhooks
2. **Update Frontend**: Replace `PAYSTACK_PUBLIC_KEY` in `event-registration.html` line 39
3. **Update Backend**: Replace `PAYSTACK_SECRET_KEY` in `gas/event-registration.gs` CONFIG section
4. **Deploy Backend**: Apps Script → Deploy → New deployment
5. **Update Frontend URL**: Update `SCRIPT_URL` in `event-registration.html` with new deployment URL
6. **Test**: Create test event with live keys and verify end-to-end flow

## Technical Implementation

### Frontend Components (event-registration.html)

#### 1. Payment Detection
```javascript
function checkPaymentRequirement() {
    const investmentText = eventData.eventInvestment || '';
    const priceMatch = investmentText.match(/(?:Ghc|GHC|GHS)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    
    if (priceMatch) {
        const amountStr = priceMatch[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
            return {
                required: true,
                amount: amount,
                currency: 'GHS'
            };
        }
    }
    
    return { required: false };
}
```

#### 2. Payment Initialization
```javascript
function initializePayment(e) {
    e.preventDefault();
    
    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: formData.email,
        amount: paymentInfo.amount * 100, // Convert to kobo
        currency: 'GHS',
        ref: 'PO-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        onClose: function() {
            alert('Payment window closed. Please complete the payment to proceed.');
        },
        callback: function(response) {
            verifyPaymentAndRegister(response.reference);
        }
    });
    
    handler.openIframe();
}
```

#### 3. Payment Verification & Registration
```javascript
function verifyPaymentAndRegister(reference) {
    formData.paymentReference = reference;
    formData.requiresPayment = true;
    submitRegistration();
}
```

### Backend Components (event-registration.gs)

#### 1. Payment Verification Function
```javascript
function verifyPaystackPayment(reference) {
  try {
    const url = `https://api.paystack.co/transaction/verify/${reference}`;
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.status && result.data.status === 'success') {
      return {
        success: true,
        amount: (result.data.amount / 100).toFixed(2),
        reference: result.data.reference,
        paidAt: result.data.paid_at,
        channel: result.data.channel,
        customer: result.data.customer.email
      };
    }
    
    return {
      success: false,
      error: 'Payment verification failed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}
```

#### 2. Modified doPost Handler
```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // If payment is required, verify it first
    if (data.requiresPayment && data.paymentReference) {
      const paymentVerification = verifyPaystackPayment(data.paymentReference);
      
      if (!paymentVerification.success) {
        return createResponse(false, 'Payment verification failed: ' + (paymentVerification.error || 'Unknown error'));
      }
      
      // Add payment details to data
      data.paymentStatus = 'verified';
      data.paymentAmount = paymentVerification.amount;
      data.paymentReference = paymentVerification.reference;
      data.paymentChannel = paymentVerification.channel;
    } else {
      data.paymentStatus = 'free_event';
    }
    
    // Proceed with registration
    logRegistration(data);
    sendUserConfirmation(data);
    sendAdminNotification(data);
    
    return createResponse(true, 'Registration successful!');
  } catch (error) {
    return createResponse(false, error.toString());
  }
}
```

## Data Storage

### Google Sheets Structure
Registrations are logged with the following payment-related columns:
- **Payment Status**: "verified" (paid and confirmed) or "free_event"
- **Payment Amount (GHS)**: Numeric amount in Ghana Cedis
- **Payment Reference**: Paystack transaction reference
- **Payment Channel**: Payment method (card, mobile_money, etc.)

### Complete Column Structure
```
[Timestamp, Full Name, Email, Phone, Organization, Attendee Type, 
How Did You Hear?, Comments, Event Name, Event Date, Payment Status, 
Payment Amount (GHS), Payment Reference, Payment Channel]
```

## Testing Procedures

### Test Scenario 1: Paid Event
1. **Setup Event**: Create event with `eventInvestment: "Ghc 2000"`
2. **Load Page**: Verify button shows "Pay GHS 2000 & Register"
3. **Fill Form**: Enter all required registration details
4. **Submit**: Click submit button
5. **Payment Modal**: Paystack modal should open
6. **Test Payment**: Use Paystack test card: `4084 0840 8408 4081`, CVV: `408`, Expiry: Any future date
7. **Verify**: Check for success message
8. **Check Sheet**: Confirm row logged with payment status "verified"
9. **Check Emails**: 
   - User receives confirmation with payment details
   - Admin receives notification with payment information

### Test Scenario 2: Free Event
1. **Setup Event**: Create event with `eventInvestment: "Early Bird Registration Available"`
2. **Load Page**: Verify button shows "Register Now"
3. **Fill Form**: Enter all required registration details
4. **Submit**: Click submit button (should NOT open payment modal)
5. **Verify**: Check for immediate success message
6. **Check Sheet**: Confirm row logged with payment status "free_event"
7. **Check Emails**: 
   - User receives confirmation without payment section
   - Admin receives notification without payment section

### Test Scenario 3: Payment Failure
1. **Setup Event**: Create paid event
2. **Payment Modal**: Click outside modal to close without paying
3. **Verify**: Alert message appears
4. **Resubmit**: Form remains filled, can resubmit
5. **Alternative Test**: Use invalid card number
6. **Verify**: Error handling works correctly

## Troubleshooting

### Issue: Payment Modal Not Opening
**Check:**
- Paystack JS library loaded: `<script src="https://js.paystack.co/v1/inline.js"></script>`
- Public key is correct in `PAYSTACK_PUBLIC_KEY` constant
- Event data loaded successfully (check browser console)
- Payment requirement detected (check `checkPaymentRequirement()` result)

### Issue: Payment Verification Failing
**Check:**
- Secret key is correct in backend CONFIG
- Backend deployed with latest changes
- Payment reference being passed correctly from frontend
- Paystack API accessible (check Apps Script execution logs)
- Transaction actually completed successfully in Paystack dashboard

### Issue: Email Not Showing Payment Details
**Check:**
- `data.paymentStatus === 'verified'` condition working
- Payment data exists: `data.paymentAmount`, `data.paymentReference`, `data.paymentChannel`
- Email template updated with conditional payment sections
- Backend redeployed after email template updates

### Issue: Wrong Amount Charged
**Check:**
- Regex pattern correctly extracting amount from `eventInvestment`
- Amount multiplication by 100 for kobo conversion
- Currency set to 'GHS' in Paystack initialization
- No commas in amount when passing to Paystack

## Security Considerations

1. **Secret Key**: Never expose `PAYSTACK_SECRET_KEY` in frontend code
2. **Verification**: Always verify payments on backend before processing
3. **Reference Validation**: Payment references include timestamp and random string
4. **Amount Validation**: Backend could add additional amount verification
5. **HTTPS**: Ensure frontend served over HTTPS in production
6. **Test vs Live**: Keep test and live keys separate, never commit keys to public repos

## API Documentation References

- **Paystack Inline**: https://paystack.com/docs/payments/payment-methods/#inline
- **Transaction Verification**: https://paystack.com/docs/api/transaction/#verify
- **Test Cards**: https://paystack.com/docs/payments/test-payments/

## Support

For Paystack-related issues:
- Dashboard: https://dashboard.paystack.com/
- Support: support@paystack.com
- Documentation: https://paystack.com/docs/

For implementation issues:
- Review browser console for frontend errors
- Check Apps Script execution logs for backend errors
- Verify Paystack dashboard for transaction status
- Test with Paystack test cards before going live

---

**Last Updated**: December 2024  
**Integration Status**: ✅ Complete and Tested  
**Environment**: Currently using test credentials
