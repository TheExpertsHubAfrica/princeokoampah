# Paystack Integration - Deployment Checklist

## Pre-Deployment Testing (Test Environment)

### ✅ Backend Setup
- [ ] Open `gas/event-registration.gs` in Google Apps Script
- [ ] Verify `PAYSTACK_SECRET_KEY` contains test key: `sk_test_1d6bdeece5d7008f7fc2476dce062c88576f8d72`
- [ ] Deploy as web app
  - Click Deploy → New deployment
  - Execute as: Me
  - Who has access: Anyone
  - Copy deployment URL
- [ ] Update `SCRIPT_URL` in `event-registration.html` with deployment URL

### ✅ Frontend Setup
- [ ] Open `event-registration.html`
- [ ] Verify `PAYSTACK_PUBLIC_KEY` contains test key: `pk_test_d3a81afef739c83459cb4aad6de8eb4b511689ab`
- [ ] Verify `SCRIPT_URL` points to deployed backend
- [ ] Verify Paystack JS library loaded: Line 36-37

### ✅ Test Paid Event Flow
- [ ] Create test event via admin portal with `eventInvestment: "Ghc 2000"`
- [ ] Open `event-registration.html` in browser
- [ ] Verify event data loads dynamically
- [ ] Verify button shows "Pay GHS 2000 & Register"
- [ ] Fill all form fields with test data
- [ ] Click submit button
- [ ] Verify Paystack modal opens
- [ ] Use test card: `4084 0840 8408 4081`, CVV: `408`, Expiry: Any future date
- [ ] Complete payment
- [ ] Verify success message appears
- [ ] Check Google Sheet for new row with payment status "verified"
- [ ] Check email (user) - should include payment confirmation section
- [ ] Check email (admin) - should include payment details section

### ✅ Test Free Event Flow
- [ ] Create test event via admin portal with `eventInvestment: "Early Bird Registration Available"`
- [ ] Refresh `event-registration.html`
- [ ] Verify button shows "Register Now"
- [ ] Fill all form fields
- [ ] Click submit button
- [ ] Verify NO payment modal opens
- [ ] Verify immediate success message
- [ ] Check Google Sheet for new row with payment status "free_event"
- [ ] Check emails - should NOT include payment sections

### ✅ Test Error Scenarios
- [ ] Test payment modal close (click outside)
- [ ] Verify alert message appears
- [ ] Test invalid card number
- [ ] Verify error handling works
- [ ] Test network error (disable internet briefly)
- [ ] Verify appropriate error messages

## Production Deployment

### 🚀 Paystack Live Credentials
1. [ ] Login to Paystack Dashboard: https://dashboard.paystack.com/
2. [ ] Navigate to Settings → API Keys & Webhooks
3. [ ] Copy **Live Public Key** (starts with `pk_live_`)
4. [ ] Copy **Live Secret Key** (starts with `sk_live_`)
5. [ ] **IMPORTANT**: Store these keys securely, never commit to public repos

### 🚀 Update Backend (event-registration.gs)
1. [ ] Open `gas/event-registration.gs` in Google Apps Script Editor
2. [ ] Find `CONFIG` section (around line 10)
3. [ ] Replace `PAYSTACK_SECRET_KEY` with live secret key
   ```javascript
   PAYSTACK_SECRET_KEY: 'sk_live_YOUR_LIVE_SECRET_KEY_HERE'
   ```
4. [ ] Click Save
5. [ ] Click Deploy → Manage deployments
6. [ ] Click Edit (pencil icon) on current deployment
7. [ ] Change version to "New version"
8. [ ] Click Deploy
9. [ ] Copy new deployment URL

### 🚀 Update Frontend (event-registration.html)
1. [ ] Open `event-registration.html`
2. [ ] Find line 39 with `PAYSTACK_PUBLIC_KEY`
3. [ ] Replace with live public key
   ```javascript
   const PAYSTACK_PUBLIC_KEY = 'pk_live_YOUR_LIVE_PUBLIC_KEY_HERE';
   ```
4. [ ] Find line 40 with `SCRIPT_URL`
5. [ ] Update with new deployment URL from backend step
6. [ ] Save file
7. [ ] Upload/deploy to web server

### 🚀 Final Production Tests
1. [ ] Create real event with actual pricing (e.g., "Ghc 5000")
2. [ ] Test registration flow end-to-end
3. [ ] Use **real card** with small amount for verification
4. [ ] Verify payment appears in Paystack Dashboard → Transactions
5. [ ] Verify registration logged in Google Sheet
6. [ ] Verify emails received with correct payment information
7. [ ] Test free event registration
8. [ ] Monitor first few real registrations closely

## Post-Deployment Monitoring

### 📊 Daily Checks (First Week)
- [ ] Check Paystack Dashboard for successful transactions
- [ ] Verify all payments match registrations in Google Sheets
- [ ] Monitor email delivery (user confirmations + admin notifications)
- [ ] Check for any failed transactions or errors
- [ ] Review Apps Script execution logs for errors

### 📊 Weekly Checks
- [ ] Reconcile payment totals (Paystack vs Sheets)
- [ ] Review any payment failures or disputes
- [ ] Check email bounce/spam reports
- [ ] Backup registration data from Google Sheets

## Rollback Plan (If Issues Occur)

### Emergency Rollback Steps
1. [ ] In Google Apps Script → Deploy → Manage deployments
2. [ ] Click Edit on current deployment
3. [ ] Change version dropdown to previous working version
4. [ ] Click Deploy
5. [ ] Update `SCRIPT_URL` in `event-registration.html` if needed
6. [ ] Temporarily switch back to test keys if necessary
7. [ ] Investigate issue before redeploying

## Important URLs

- **Paystack Dashboard**: https://dashboard.paystack.com/
- **Paystack Transactions**: https://dashboard.paystack.com/transactions
- **Paystack API Docs**: https://paystack.com/docs/api/
- **Google Apps Script**: https://script.google.com/
- **Current Admin Backend**: https://script.google.com/macros/s/AKfycbwoIbQONuAk3QqNe8uFQDEd5HpO1-O4gfgO1knzCeAafuzWAtS_R-G9un4CzqdjqyNC/exec
- **Current Registration Backend**: (Update after deployment)

## Security Reminders

- ✅ Never share secret keys publicly
- ✅ Never commit keys to public repositories
- ✅ Use environment variables or config files for keys
- ✅ Rotate keys periodically for security
- ✅ Monitor Paystack dashboard for suspicious activity
- ✅ Keep test and live environments separate
- ✅ Use HTTPS for all production deployments

## Support Contacts

- **Paystack Support**: support@paystack.com
- **Paystack Docs**: https://paystack.com/docs/
- **Google Apps Script Forum**: https://support.google.com/apps-script/

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Live Public Key**: pk_live_____________... (first 10 chars only)  
**Live Secret Key**: NEVER DOCUMENT (store securely)  
**Backend Deployment URL**: _______________  
**Status**: ⏳ Pending / ✅ Complete
