/**
 * STICKIFY 21 - Domain Validation Engine
 */
import { CONFIG } from '../config/config.js';

/**
 * Validate customer name (>= 3 chars, Arabic or Latin letters & spaces)
 */
export function validateCustomerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'الاسم مطلوب' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: 'الاسم يجب ألا يقل عن 3 أحرف' };
  }
  // Allow Arabic, English, spaces, dashes
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'الاسم يحتوي على رموز غير مسموح بها' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate and normalize Egyptian mobile number:
 * Accepts: 010..., 011..., 012..., 015... with or without +20 / 0020 / spaces / dashes.
 * Normalizes to standard: 01xxxxxxxxx (11 digits).
 */
export function validateEgyptianPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'رقم الهاتف مطلوب' };
  }

  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '').trim();

  // Convert Arabic/Eastern numerals if any
  cleaned = cleaned.replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 1632);

  // Strip international prefix +20 or 0020 or 20
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('0020')) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // If missing leading zero (e.g. 10xxxxxxxx -> 010xxxxxxxx)
  if (cleaned.length === 10 && /^[1][0125]/.test(cleaned)) {
    cleaned = '0' + cleaned;
  }

  // Egyptian mobile regex: 01[0,1,2,5] followed by 8 digits
  const egPhoneRegex = /^01[0125][0-9]{8}$/;
  if (!egPhoneRegex.test(cleaned)) {
    return { 
      valid: false, 
      error: 'رقم الهاتف يجب أن يكون رقم محمول مصري صحيح (010, 011, 012, 015) مكون من 11 رقماً' 
    };
  }

  return { valid: true, value: cleaned };
}

/**
 * Validate governorate is in the official list of 27 governorates
 */
export function validateGovernorate(gov) {
  if (!gov || typeof gov !== 'string') {
    return { valid: false, error: 'يرجى اختيار المحافظة' };
  }
  const trimmed = gov.trim();
  const found = CONFIG.GOVERNORATES.some(g => g.nameAr === trimmed) || CONFIG.SHIPPING_RATES[trimmed] !== undefined;
  if (!found) {
    return { valid: false, error: 'المحافظة المختارة غير صالحة' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate address (>= 5 chars)
 */
export function validateAddress(address) {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'العنوان بالتفصيل مطلوب' };
  }
  const trimmed = address.trim();
  if (trimmed.length < 5) {
    return { valid: false, error: 'العنوان قصير جداً، يرجى كتابة اسم الشارع والمنطقة بوضوح' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate order notes (max 500 chars)
 */
export function validateNotes(notes) {
  if (!notes) return { valid: true, value: '' };
  if (typeof notes !== 'string') return { valid: false, error: 'الملاحظات غير صالحة' };
  if (notes.length > 500) {
    return { valid: false, error: 'الملاحظات يجب ألا تتجاوز 500 حرف' };
  }
  return { valid: true, value: notes.trim() };
}

/**
 * Validate quantity: integer 1 - 99
 */
export function validateQuantity(qty) {
  const num = Number(qty);
  if (!Number.isInteger(num) || num < 1 || num > 99) {
    return { valid: false, error: 'الكمية يجب أن تكون عدداً صحيحاً بين 1 و 99' };
  }
  return { valid: true, value: num };
}

/**
 * Validate price: non-negative number
 */
export function validatePrice(price) {
  const num = Number(price);
  if (isNaN(num) || num < 0) {
    return { valid: false, error: 'السعر غير صالح' };
  }
  return { valid: true, value: num };
}

/**
 * Validate full checkout form data
 * @param {Object} formData
 * @returns {Object} { isValid: boolean, errors: Object, values: Object }
 */
export function validateCheckoutForm(formData) {
  const errors = {};
  const values = {};

  const nameCheck = validateCustomerName(formData.name);
  if (!nameCheck.valid) errors.name = nameCheck.error;
  else values.name = nameCheck.value;

  const phoneCheck = validateEgyptianPhone(formData.phone);
  if (!phoneCheck.valid) errors.phone = phoneCheck.error;
  else values.phone = phoneCheck.value;

  const govCheck = validateGovernorate(formData.governorate || formData.city);
  if (!govCheck.valid) errors.governorate = govCheck.error;
  else values.governorate = govCheck.value;

  const addrCheck = validateAddress(formData.address);
  if (!addrCheck.valid) errors.address = addrCheck.error;
  else values.address = addrCheck.value;

  const notesCheck = validateNotes(formData.notes);
  if (!notesCheck.valid) errors.notes = notesCheck.error;
  else values.notes = notesCheck.value;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values
  };
}
