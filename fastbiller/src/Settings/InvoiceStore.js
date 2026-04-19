// InvoiceStore.js

const STORAGE_KEYS = {
    valueInWords: 'invoiceValueInWordType',
    margins: 'invoiceMargins',
    invoiceLayout: 'invoiceNumberLayout',
    connectionToDatabase: 'connectionToDatabaseStatus',  // Newly added
};

// Load "Value in Words" or default
let invoiceValueInWordType = localStorage.getItem(STORAGE_KEYS.valueInWords) || 'Indian';

// Load "Invoice Layout" or default
let invoiceLayout = localStorage.getItem(STORAGE_KEYS.invoiceLayout) || '';

// Load "Connection to Database" status or default
let connectionToDatabase = localStorage.getItem(STORAGE_KEYS.connectionToDatabase) || 'NotConnected';

// Load margins or default
let invoiceMargins;
try {
    invoiceMargins = JSON.parse(localStorage.getItem(STORAGE_KEYS.margins));
    if (!invoiceMargins) throw new Error();
} catch {
    invoiceMargins = {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
    };
}

let subscribers = [];

const InvoiceStore = {
    // "Value in Words"
    getInvoiceValueInWordType: () => invoiceValueInWordType,
    setInvoiceValueInWordType: (value) => {
        invoiceValueInWordType = value;
        localStorage.setItem(STORAGE_KEYS.valueInWords, value);
        notify();
    },

    // "Invoice Layout"
    getInvoiceLayout: () => invoiceLayout,
    setInvoiceLayout: (value) => {
        invoiceLayout = value;
        localStorage.setItem(STORAGE_KEYS.invoiceLayout, value);
        notify();
    },

    // "Connection to Database"
    getConnectionToDatabase: () => connectionToDatabase,
    setConnectionToDatabase: (value) => {
        if (['NotConnected', 'Connected(Changed)', 'Updated'].includes(value)) {
            connectionToDatabase = value;
            localStorage.setItem(STORAGE_KEYS.connectionToDatabase, value);
            notify();
        } else {
            console.warn(`Invalid value for connectionToDatabase: ${value}`);
        }
    },

    // Invoice Margins
    getInvoiceMargins: () => invoiceMargins,
    setInvoiceMargins: (newMargins) => {
        invoiceMargins = { ...invoiceMargins, ...newMargins };
        localStorage.setItem(STORAGE_KEYS.margins, JSON.stringify(invoiceMargins));
        notify();
    },

    // Subscribe
    subscribe: (callback) => {
        subscribers.push(callback);
        return () => {
            subscribers = subscribers.filter((fn) => fn !== callback);
        };
    }
};

function notify() {
    for (const cb of subscribers) {
        cb({
            invoiceValueInWordType,
            invoiceLayout,
            invoiceMargins,
            connectionToDatabase
        });
    }
}

export default InvoiceStore;
