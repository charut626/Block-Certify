const poppler = require("pdf-poppler");
const path = require("path");
const fs = require("fs");

if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");

const file = path.resolve("./test.pdf");

const options = {
  format: "png",
  out_dir: path.resolve("./tmp"),
  out_prefix: "test_page",
  page: 1
};

poppler.convert(file, options).then(() => {
  console.log("✅ Conversion successful! Check ./tmp folder");
}).catch((err) => {
  console.error("❌ Conversion failed:", err.message);
});