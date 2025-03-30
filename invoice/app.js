// Constants
const MAX_MEMO_LENGTH = 28; // Maximum length for memo_text in Stellar
const MAX_RECENT_TOKENS = 3; // Maximum number of recent tokens to show
const STORAGE_KEYS = {
    RECIPIENT: 'stellar_invoice_recipient',
    TOKEN_NAME: 'stellar_invoice_token_name',
    TOKEN_ISSUER: 'stellar_invoice_token_issuer',
    RECENT_TOKENS: 'stellar_invoice_recent_tokens'
};

// Base32 alphabet for Stellar addresses
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// DOM Elements
const form = document.getElementById('invoice-form');
const creationMode = document.getElementById('creation-mode');
const viewMode = document.getElementById('view-mode');
const loadingElement = document.getElementById('loading');
const copyRecipientBtn = document.getElementById('copy-recipient');
const copyLinkBtn = document.getElementById('copy-link');
const openLinkBtn = document.getElementById('open-link');
const advancedPanel = document.querySelector('.advanced-panel');
const recentTokensContainer = document.getElementById('recent-tokens');

// Form Elements
const recipientInput = document.getElementById('recipient');
const tokenNameInput = document.getElementById('token-name');
const tokenIssuerInput = document.getElementById('token-issuer');
const amountInput = document.getElementById('amount');
const memoInput = document.getElementById('memo');

// View Mode Elements
const viewRecipient = document.getElementById('view-recipient');
const viewAmount = document.getElementById('view-amount');
const viewToken = document.getElementById('view-token');
const viewIssuer = document.getElementById('view-issuer');
const viewMemo = document.getElementById('view-memo');
const qrCodeContainer = document.getElementById('qr-code');
const paymentLinkText = document.getElementById('payment-link-text');

// Load saved values from localStorage
function loadSavedValues() {
    recipientInput.value = localStorage.getItem(STORAGE_KEYS.RECIPIENT) || '';
    tokenNameInput.value = localStorage.getItem(STORAGE_KEYS.TOKEN_NAME) || '';
    tokenIssuerInput.value = localStorage.getItem(STORAGE_KEYS.TOKEN_ISSUER) || '';
    updateRecentTokensDisplay();
}

// Save form values to localStorage
function saveValues() {
    localStorage.setItem(STORAGE_KEYS.RECIPIENT, recipientInput.value);
    localStorage.setItem(STORAGE_KEYS.TOKEN_NAME, tokenNameInput.value);
    localStorage.setItem(STORAGE_KEYS.TOKEN_ISSUER, tokenIssuerInput.value);
}

// Save token pair to recent tokens
function saveTokenPair() {
    const recentTokens = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_TOKENS) || '[]');
    const newToken = {
        name: tokenNameInput.value,
        issuer: tokenIssuerInput.value
    };
    
    // Remove if already exists
    const existingIndex = recentTokens.findIndex(t => t.name === newToken.name && t.issuer === newToken.issuer);
    if (existingIndex !== -1) {
        recentTokens.splice(existingIndex, 1);
    }
    
    // Add to beginning
    recentTokens.unshift(newToken);
    
    // Keep only the most recent tokens
    if (recentTokens.length > MAX_RECENT_TOKENS) {
        recentTokens.pop();
    }
    
    localStorage.setItem(STORAGE_KEYS.RECENT_TOKENS, JSON.stringify(recentTokens));
    updateRecentTokensDisplay();
}

// Update recent tokens display
function updateRecentTokensDisplay() {
    const recentTokens = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_TOKENS) || '[]');
    recentTokensContainer.innerHTML = '';
    
    recentTokens.forEach(token => {
        const tokenElement = document.createElement('span');
        tokenElement.className = 'recent-token';
        tokenElement.textContent = token.name;
        tokenElement.title = `Token: ${token.name}\nIssuer: ${token.issuer}`;
        tokenElement.addEventListener('click', () => {
            tokenNameInput.value = token.name;
            tokenIssuerInput.value = token.issuer;
        });
        recentTokensContainer.appendChild(tokenElement);
    });
}

// Validate Stellar address
function isValidStellarAddress(address) {
    // Check if address starts with G (public key)
    if (!address.startsWith('G')) return false;
    
    // Check length (should be 56 characters for a public key)
    if (address.length !== 56) return false;
    
    // Check if all characters are valid base32
    for (let i = 0; i < address.length; i++) {
        if (!BASE32_ALPHABET.includes(address[i])) return false;
    }
    
    // Check if the address is properly padded
    const padding = address.match(/=+$/);
    if (padding && padding[0].length > 6) return false;
    
    return true;
}

// Validate amount
function isValidAmount(amount) {
    return !isNaN(amount) && amount > 0;
}

// Validate memo
function isValidMemo(memo) {
    return !memo || memo.length <= MAX_MEMO_LENGTH;
}

// Show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(`${elementId}-error`);
    errorElement.textContent = message;
}

// Clear error message
function clearError(elementId) {
    const errorElement = document.getElementById(`${elementId}-error`);
    errorElement.textContent = '';
}

// Generate SEP-7 URI
function generateSep7Uri(params) {
    const queryParams = new URLSearchParams();
    queryParams.set('destination', params.recipient);
    queryParams.set('amount', params.amount);
    queryParams.set('asset_code', params.tokenName);
    queryParams.set('asset_issuer', params.tokenIssuer);
    
    if (params.memo) {
        queryParams.set('memo', params.memo);
        queryParams.set('memo_type', 'text');
    }
    
    return `web+stellar:pay?${queryParams.toString()}`;
}

// Generate QR code
function generateQRCode(uri) {
    qrCodeContainer.innerHTML = '';
    new QRCode(qrCodeContainer, {
        text: uri,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });
}

// Switch to view mode
function switchToViewMode(params) {
    loadingElement.classList.remove('active');
    creationMode.style.display = 'none';
    viewMode.style.display = 'block';

    viewRecipient.textContent = params.recipient;
    viewAmount.textContent = params.amount;
    viewToken.textContent = params.tokenName;
    viewIssuer.textContent = params.tokenIssuer;
    viewMemo.textContent = params.memo || '—';

    const uri = generateSep7Uri(params);
    paymentLinkText.textContent = uri;
    generateQRCode(uri);
    updatePaymentLinkHref(uri);
}

// Handle form submission
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Clear previous errors
    ['recipient', 'token-name', 'token-issuer', 'amount', 'memo'].forEach(clearError);

    // Validate inputs
    let isValid = true;

    if (!isValidStellarAddress(recipientInput.value)) {
        showError('recipient', 'Invalid Stellar address');
        isValid = false;
    }

    if (!tokenNameInput.value.trim()) {
        showError('token-name', 'Token name is required');
        isValid = false;
    }

    if (!isValidStellarAddress(tokenIssuerInput.value)) {
        showError('token-issuer', 'Invalid token issuer address');
        isValid = false;
    }

    if (!isValidAmount(amountInput.value)) {
        showError('amount', 'Amount must be a positive number');
        isValid = false;
    }

    if (!isValidMemo(memoInput.value)) {
        showError('memo', `Memo cannot exceed ${MAX_MEMO_LENGTH} characters`);
        isValid = false;
    }

    if (!isValid) return;

    // Save form values and token pair
    saveValues();
    saveTokenPair();

    // Create URL parameters
    const params = {
        recipient: recipientInput.value,
        tokenName: tokenNameInput.value,
        tokenIssuer: tokenIssuerInput.value,
        amount: amountInput.value,
        memo: memoInput.value
    };

    // Update URL and switch to view mode
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
    });
    window.history.pushState({}, '', url);
    switchToViewMode(params);
});

// Copy recipient address to token issuer
copyRecipientBtn.addEventListener('click', function() {
    tokenIssuerInput.value = recipientInput.value;
    const originalTitle = copyRecipientBtn.title;
    copyRecipientBtn.title = 'Copied!';
    setTimeout(() => {
        copyRecipientBtn.title = originalTitle;
    }, 2000);
});

// Copy payment link
copyLinkBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(paymentLinkText.textContent)
        .then(() => {
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy Link';
            }, 2000);
        })
        .catch(err => console.error('Failed to copy:', err));
});

// Check URL parameters on page load
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {
        recipient: urlParams.get('recipient'),
        tokenName: urlParams.get('tokenName'),
        tokenIssuer: urlParams.get('tokenIssuer'),
        amount: urlParams.get('amount'),
        memo: urlParams.get('memo')
    };

    // If we have all required parameters, switch to view mode
    if (params.recipient && params.tokenName && params.tokenIssuer && params.amount) {
        switchToViewMode(params);
    } else {
        loadingElement.classList.remove('active');
        loadSavedValues();
    }
}

// Update payment link href
function updatePaymentLinkHref(uri) {
    const encodedUri = encodeURIComponent(uri);
    openLinkBtn.href = `https://montelibero.net/redirect/?to=${encodedUri}`;
}

// Toggle advanced panel
advancedPanel.querySelector('.advanced-panel-header').addEventListener('click', function() {
    advancedPanel.classList.toggle('expanded');
});

// Initialize the app
document.addEventListener('DOMContentLoaded', checkUrlParameters); 