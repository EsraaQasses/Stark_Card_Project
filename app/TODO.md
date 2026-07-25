# TODO: Dynamic Payment Requirements Labels Implementation

Current working directory: stark-mobile

## Plan Steps (from approved plan):

### 1. ✅ [DONE] Create TODO.mdr
### 2. ✅ Update Payment.js
   - ✅ Modify buildRequirementPayload() to return {values: {...}, _labels: {key: field_name}}
   - ✅ In onPay(), merge requirementPayload.values + requirementPayload._labels into user_inputs
   - ✅ Add explanatory comment

### 3. ✅ Update MyPayments.js  
   - ✅ Expand SKIP_KEYS Set to full task list (wallet_id, etc. + _labels)
   - ✅ In buildDisplayInputs(): label = inputs._labels?.[key] || LABELS[key] || key.replace(/_/g, ' ')
   - ✅ Add comment for _labels usage
   - ✅ Verify PaymentCard expanded uses updated buildDisplayInputs (no dupes)

### 4. Test
   - [ ] Run payment flow, verify user_inputs saves _labels in backend (check network/ logs)
   - [ ] Verify MyPayments shows dynamic labels for all req fields (not just phone/id)
   - [ ] Check RTL/formatting preserved

### 5. attempt_completion

**All code changes complete. Ready for testing.**
   - [ ] Run payment flow, verify user_inputs saves _labels in backend (check network/ logs)
   - [ ] Verify MyPayments shows dynamic labels for all req fields (not just phone/id)
   - [ ] Check RTL/formatting preserved

### 5. ✅ [PENDING] attempt_completion

**Next step: Edit Payment.js**

