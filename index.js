const express = require('express');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

let paymentQueue = [];
let urgentQueue = [];
let transactionStack = [];

const invoicesDir = path.join(__dirname, 'invoices');
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir);
}

const logTransaction = (transaction) => {
    try {
        fs.appendFileSync('transactions.json', JSON.stringify(transaction) + '\n');
    } catch (err) {
        console.error("Error logging transaction:", err);
    }
};

function enqueue(queue, item) {
    queue.push(item);
}

function dequeue(queue) {
    return queue.shift();
}

function pushToStack(stack, item) {
    stack.push(item);
}

function popFromStack(stack) {
    return stack.pop();
}

app.post('/payments', (req, res) => {
    const { userId, billType, amount } = req.body;
    const payment = { userId, billType, amount, timestamp: new Date().toISOString(), urgent: false };

    enqueue(paymentQueue, payment);
    logTransaction(payment);
    res.status(201).json({ message: "Payment request added to queue", payment });
});

app.post('/urgent-payments', (req, res) => {
    const { userId, billType, amount } = req.body;
    const payment = { userId, billType, amount, timestamp: new Date().toISOString(), urgent: true };

    enqueue(urgentQueue, payment);
    logTransaction(payment);
    res.status(201).json({ message: "Urgent payment request added to priority queue", payment });
});

app.get('/process-payments', async (req, res) => {
    while (urgentQueue.length > 0) {
        const urgentPayment = dequeue(urgentQueue);
        await handlePayment(urgentPayment);
    }
    while (paymentQueue.length > 0) {
        const payment = dequeue(paymentQueue);
        await handlePayment(payment);
    }
    res.json({ message: "All payments processed" });
});

async function handlePayment(payment) {
    pushToStack(transactionStack, payment);
    generateInvoice(payment);
}

const generateInvoice = (payment) => {
    const doc = new PDFDocument();
    const filePath = path.join(invoicesDir, `invoice-${payment.userId}-${Date.now()}.pdf`);

    try {
        doc.pipe(fs.createWriteStream(filePath));
        doc.text(`Invoice for User ID: ${payment.userId}`);
        doc.text(`Bill Type: ${payment.billType}`);
        doc.text(`Amount: ${payment.amount}`);
        doc.text(`Date: ${payment.timestamp}`);
        doc.end();

        console.log(`Invoice generated for payment: ${payment.userId}`);
    } catch (err) {
        console.error("Error generating invoice:", err);
    }
};

app.get('/history', (req, res) => {
    res.json(transactionStack);
});

app.post('/undo', (req, res) => {
    const lastTransaction = popFromStack(transactionStack);

    if (!lastTransaction) {
        return res.status(400).json({ message: "No transactions to undo" });
    }

    res.json({ message: "Last transaction undone", lastTransaction });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
