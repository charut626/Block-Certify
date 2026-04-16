require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");

const { ethers } = require("ethers");
const abi = require("./abi.json");

const {
  extractText,
  extractQR,
  detectCertificateType,
  detectIssuer
} = require("./ocr");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files (like the APK) from a /public folder
app.use("/public", express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const upload = multer({ dest: "/tmp/" });

/* ==============================
Polygon Amoy RPC Fallback Setup
============================== */

const provider = new ethers.FallbackProvider([
  {
    provider: new ethers.JsonRpcProvider(
      "https://rpc-amoy.polygon.technology"
    ),
    priority: 1,
    stallTimeout: 2000,
    weight: 2
  },
  {
    provider: new ethers.JsonRpcProvider(
      "https://polygon-amoy.publicnode.com"
    ),
    priority: 2,
    stallTimeout: 2000,
    weight: 1
  },
  {
    provider: new ethers.JsonRpcProvider(
      "https://polygon-amoy.drpc.org"
    ),
    priority: 3,
    stallTimeout: 2000,
    weight: 1
  }
]);

const wallet = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  provider
);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  wallet
);

console.log("Connected wallet:", wallet.address);
console.log("Blockchain connected successfully");


/* ==============================
UPLOAD CERTIFICATE + STORE HASH
============================== */

app.post("/upload", upload.single("certificate"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No certificate uploaded"
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    console.log("Generated hash:", hash);

    fs.unlinkSync(req.file.path);

    /* CHECK DUPLICATE */

    const exists = await contract.verifyCertificate("0x" + hash);

    if (exists) {

      try {

        console.log("Certificate already exists. Fetching original transaction...");

        const filter = contract.filters.CertificateStored("0x" + hash);

        const events = await contract.queryFilter(filter);

        const txHash =
          events.length > 0
            ? events[0].transactionHash
            : "Transaction hash not found";

        return res.status(200).json({
          message: "Certificate already stored on blockchain",
          certificateHash: hash,
          transactionHash: txHash
        });

      }

      catch (eventError) {

        console.log("Event lookup failed:", eventError.message);

        return res.status(200).json({
          message: "Certificate already stored on blockchain",
          certificateHash: hash,
          transactionHash: "Unable to retrieve transaction hash"
        });

      }

    }

    /* STORE HASH WITH RETRY LOGIC */

    let tx;

    for (let i = 0; i < 3; i++) {

      try {

        tx = await contract.storeCertificate("0x" + hash);

        console.log("Transaction submitted:", tx.hash);

        await tx.wait();

        console.log("Stored successfully on blockchain");

        break;

      }

      catch (err) {

        console.log("Retrying blockchain transaction...");

      }

    }

    if (!tx) {

      return res.status(500).json({
        error: "Blockchain temporarily unavailable. Try again."
      });

    }

    /* SUCCESS RESPONSE */

    res.json({
      message: "Certificate stored on blockchain",
      transactionHash: tx.hash,
      certificateHash: hash
    });

  }

  catch (error) {

    console.error("FULL ERROR:", error.message);

    res.status(500).json({
      error: "Blockchain storage failed",
      details: error.message
    });

  }

});


/* ==============================
VERIFY CERTIFICATE AUTHENTICITY
============================== */

app.post("/verify", upload.single("certificate"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No certificate uploaded"
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    fs.unlinkSync(req.file.path);

    const exists = await contract.verifyCertificate("0x" + hash);

    res.json({
      certificateHash: hash,
      blockchainStatus: exists,
      verificationResult:
        exists
          ? "VALID CERTIFICATE"
          : "TAMPERED CERTIFICATE"
    });

  }

  catch (error) {

    res.status(500).json({
      message: "Verification failed",
      error: error.message
    });

  }

});


/* ==============================
OCR ANALYSIS MODULE
============================== */

app.post("/analyze", upload.single("certificate"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    console.log("Running OCR...");

    const text = await extractText(filePath, mimeType);

    console.log("Extracted text:", text);

    console.log("Checking QR code...");

    const qrData = await extractQR(filePath, mimeType);

    console.log("QR Data:", qrData);

    const certType = detectCertificateType(text, qrData);

    const issuerInfo = detectIssuer(text);

    fs.unlinkSync(filePath);

    res.json({
      extractedText: text,
      qrCode: qrData,
      certificateType: certType,
      issuer: issuerInfo
    });

  }

  catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Analysis failed",
      error: error.message
    });

  }

});


/* ==============================
START SERVER
============================== */

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Export for Vercel Serverless
module.exports = app;