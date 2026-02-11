import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date in DD/MMM/YYYY format (e.g., 06/nov/2025)
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Strict email validation function
 * Validates email format and rejects invalid patterns like test@gmail.com.com
 */
export function validateEmail(email: string): boolean {
  // Basic checks
  if (email.includes('..')) return false; // No consecutive dots
  if (email.split('@').length !== 2) return false; // Exactly one @
  
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  
  const [localPart, domain] = parts;
  
  // Local part validation
  if (!localPart || localPart.length === 0) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  
  // Domain validation
  if (!domain || domain.length === 0) return false;
  if (domain.includes('..')) return false; // No consecutive dots in domain
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  
  // Check for proper TLD format
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false; // Must have at least domain.tld
  
  const lastPart = domainParts[domainParts.length - 1].toLowerCase();
  if (!/^[a-zA-Z]{2,}$/.test(lastPart)) return false; // TLD must be 2+ letters
  
  // Common TLDs list
  const commonTLDs = ['com', 'net', 'org', 'edu', 'gov', 'co', 'in', 'uk', 'au', 'ca', 'de', 'fr', 'jp', 'cn', 'io', 'me', 'tv', 'info', 'biz', 'xyz'];
  
  // Check for duplicate TLD pattern (e.g., test@gmail.com.com)
  if (domainParts.length >= 3) {
    const secondLast = domainParts[domainParts.length - 2].toLowerCase();
    const last = domainParts[domainParts.length - 1].toLowerCase();
    
    // If last two parts are identical and both are common TLDs, it's likely invalid
    if (secondLast === last && commonTLDs.includes(secondLast)) {
      return false; // Reject patterns like test@gmail.com.com
    }
    
    // Also check for patterns like test@domain.com.com where both are TLD-like
    if (secondLast.length >= 2 && secondLast.length <= 4 && 
        last.length >= 2 && last.length <= 4 && 
        secondLast === last) {
      return false; // Reject duplicate TLD patterns
    }
  }
  
  // Final regex check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Format status string to camel case with underscores preserved
 * Examples: "returned" -> "Returned", "out_for_delivery" -> "Out_For_Delivery"
 */
export function formatStatus(status: string): string {
  if (!status) return '';
  
  // Special case: Convert "confirmed" to "Click and Collect"
  if (status.toLowerCase() === 'confirmed') {
    return 'Click and Collect';
  }
  
  // Special case: Convert "returned" to "Return Requests"
  if (status.toLowerCase() === 'returned') {
    return 'Return Requests';
  }
  
  // Special case: Convert "return_approved" to "Return Approved"
  if (status.toLowerCase() === 'return_approved') {
    return 'Return Approved';
  }
  
  // Special case: Convert "return_rejected" to "Return Rejected"
  if (status.toLowerCase() === 'return_rejected') {
    return 'Return Rejected';
  }
  
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
}