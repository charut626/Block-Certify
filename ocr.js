const Tesseract = require("tesseract.js");
const Jimp = require("jimp");
const jsQR = require("jsqr");
const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");

/*
==============================
Extract Text from Certificate
Supports PDF + Images
==============================
*/
async function extractText(filePath, mimeType) {

    try {

        const isPdf = mimeType === "application/pdf";

        if (isPdf) {
            
            const fileBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(fileBuffer);
            return data.text;
            
        }

        // Initialize Tesseract worker pointing to Vercel's allowed /tmp folder
        const worker = await Tesseract.createWorker("eng", 1, {
            cachePath: "/tmp",
            cacheMethod: "write"
        });
        
        const { data: { text } } = await worker.recognize(filePath);
        
        // Terminate worker to free Vercel memory
        await worker.terminate();

        return text;

    } catch (err) {

        console.log("OCR ERROR:", err);
        return "";
    }
}


/*
==============================
Detect QR Code from Certificate
==============================
*/
async function extractQR(filePath, mimeType) {

    try {

        const isPdf = mimeType === "application/pdf";

        if (isPdf) {
            console.log("Skipping QR code extraction for PDF format on serverless.");
            return null;
        }

        const imagePath = filePath;
        const image = await Jimp.read(imagePath);

        const { data, width, height } = image.bitmap;

        const qrData = jsQR(data, width, height);

        return qrData ? qrData.data : null;

    } catch (err) {

        console.log("QR ERROR:", err);
        return null;
    }
}


/*
==============================
Detect Certificate Type
==============================
*/
function detectCertificateType(text, qrData) {

    if (qrData) {
        return {
            type: "QR_BASED",
            verificationUrl: qrData
        };
    }

    const urlMatch = text.match(/https?:\/\/[^\s]+/);

    if (urlMatch) {
        return {
            type: "URL_BASED",
            verificationUrl: urlMatch[0]
        };
    }

    const idMatch = text.match(/[A-Z0-9]{4,}-[A-Z0-9]{4,}/);

    if (idMatch) {
        return {
            type: "ID_BASED",
            certificateId: idMatch[0]
        };
    }

    return {
        type: "UNKNOWN",
        verificationUrl: null
    };
}


/*
==============================
Detect Issuer from Text
==============================
*/
function detectIssuer(text) {

    const issuers = {
        microsoft: "https://learn.microsoft.com/en-us/users/me/credentials",
        cisco: "https://aspen.eccouncil.org/verify",
        coursera: "https://coursera.org/verify",
        nptel: "https://nptel.ac.in/noc/E_Certificate/noc",
        udemy: "https://udemy.com/certificate",
        google: "https://grow.google/certificates",
        aws: "https://aws.amazon.com/verification",
        amazon: "https://aws.amazon.com/verification",
        "ec-council": "https://aspen.eccouncil.org/verify",
        comptia: "https://verify.comptia.org"
    };

    const lowerText = text.toLowerCase();

    for (const [issuer, portal] of Object.entries(issuers)) {

        if (lowerText.includes(issuer)) {
            return { issuer, portal };
        }

    }

    return {
        issuer: "unknown",
        portal: null
    };
}


module.exports = {
    extractText,
    extractQR,
    detectCertificateType,
    detectIssuer
};