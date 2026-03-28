declare global {
  interface Window {
    PaystackPop: any;
  }
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

export function loadPaystackScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.onload = () => { scriptLoaded = true; scriptLoading = null; resolve(); };
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("Failed to load Paystack. Check your internet connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export interface PaystackConfig {
  email: string;
  amountInKobo: number;
  tier: string;
  customWords?: number;
  publicKey: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export function openPaystackPopup(config: PaystackConfig) {
  if (!window.PaystackPop) {
    throw new Error("Paystack is not loaded yet. Please try again in a moment.");
  }
  const handler = window.PaystackPop.setup({
    key: config.publicKey,
    email: config.email,
    amount: config.amountInKobo,
    currency: "NGN",
    metadata: { tier: config.tier, custom_words: config.customWords || 0 },
    callback: (response: any) => config.onSuccess(response.reference),
    onClose: config.onClose,
  });
  handler.openIframe();
}
