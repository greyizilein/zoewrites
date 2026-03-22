declare global {
  interface Window {
    PaystackPop: any;
  }
}

let scriptLoaded = false;

export function loadPaystackScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Paystack"));
    document.head.appendChild(script);
  });
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
