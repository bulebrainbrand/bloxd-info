const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log(1);
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/get-game-ccus")) {
      console.log("catch", url);
      try {
        const json = await res.json();
        let history = [];
        if (fs.existsSync("data.json")) {
          const content = fs.readFileSync("data.json", "utf-8");
          try {
            history = JSON.parse(content);
            if (!Array.isArray(history)) history = [];
          } catch (e) {
            history = [];
          }
        }
        const output = {
          at: new Date().toISOString(),
          data: json,
        };
        history.push(output);
        fs.writeFileSync("data.json", JSON.stringify(history, null, 2));
        browser.close();
      } catch (err) {
        console.log("save error", err);
        browser.close();
      }
    }
  });
  await page.goto("https://bloxd.io", {
    waitUntil: "networkidle",
    timeout: 6000000,
  });
})();
