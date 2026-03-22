const { chromium } = require("playwright");
const fs = require("fs");

const writeJsonSafely = (filePath, data) => {
  let history = [];
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    try {
      history = JSON.parse(content);
      if (!Array.isArray(history)) history = [];
    } catch (e) {
      history = [];
    }
  }
  history.push({ at: new Date().toISOString(), data });
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
};

const waitForResponseData = (
  page,
  urlFragment,
  outputPath,
  timeoutMs = 30000,
) => {
  return new Promise((resolve, reject) => {
    let timer = null;
    const onResponse = async (res) => {
      if (res.url().includes(urlFragment)) {
        try {
          const json = await res.json();
          writeJsonSafely(outputPath, json);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      }
    };

    let resolvedOrRejected = false;

    const cleanup = () => {
      clearTimeout(timer);
      page.off("response", onResponse);
    };

    const finish = (value) => {
      if (resolvedOrRejected) return;
      resolvedOrRejected = true;
      cleanup();
      resolve(value);
    };

    const fail = (error) => {
      if (resolvedOrRejected) return;
      resolvedOrRejected = true;
      cleanup();
      reject(error);
    };

    page.on("response", async (res) => {
      if (res.url().includes(urlFragment)) {
        try {
          const json = await res.json();
          writeJsonSafely(outputPath, json);
          finish(json);
        } catch (err) {
          fail(err);
        }
      }
    });

    timer = setTimeout(() => {
      fail(new Error(`Timeout waiting for response: ${urlFragment}`));
    }, timeoutMs);
  });
};

const waitForResponseData2 = (
  page,
  urlFragment,
  outputPath,
  getPageAmount,
  timeoutMs = 180000,
) => {
  return new Promise(async (resolve, reject) => {
    let timer = null;
    let data = [];

    let resolvedOrRejected = false;

    const cleanup = () => {
      clearTimeout(timer);
    };

    const finish = (value) => {
      if (resolvedOrRejected) return;
      resolvedOrRejected = true;
      cleanup();
      resolve(value);
    };

    const fail = (error) => {
      if (resolvedOrRejected) return;
      resolvedOrRejected = true;
      cleanup();
      reject(error);
    };
    timer = setTimeout(() => {
      fail(new Error(`Timeout waiting for response: ${urlFragment}`));
    }, timeoutMs);

    for (let i = 0; i < getPageAmount; i++) {
      const responsePromise = page.waitForResponse((res) =>
        res.url().includes("/get-published-game-previews"),
      );
      const res = await responsePromise;
      const json = await res.json();
      data.push(json.results);
      await page
        .locator("div.CustomGamePagination > div:last-child:has(> i)")
        .last()
        .evaluate((el) => el.click());
    }
    console.log(data);
    writeJsonSafely(outputPath, { results: data });
    resolve({ results: data });
  });
};

const setAllCCus = async (browser) => {
  const page = await browser.newPage();
  try {
    const responsePromise = waitForResponseData(
      page,
      "/get-game-ccus",
      "data.json",
    );
    await page.goto("https://bloxd.io", {
      waitUntil: "load",
      timeout: 300000,
    });
    console.log("navigated all CCus");
    await responsePromise;
  } catch (err) {
    console.log("setAllCCus error:", err.message);
    process.exit(1);
  } finally {
    await page.close().catch(() => {});
  }
};

const setPublishedGame = async (browser) => {
  const page = await browser.newPage();
  try {
    const responsePromise = waitForResponseData2(
      page,
      "/get-published-game-preview",
      "custom_game_data.json",
      5,
    );
    await page.goto("https://bloxd.io/custom-games", {
      waitUntil: "load",
      timeout: 300000,
    });
    console.log("navigated published game");
    await responsePromise;
  } catch (err) {
    console.log("setPublishedGame error:", err.message);
    process.exit(1);
  } finally {
    await page.close().catch(() => {});
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await Promise.all([setAllCCus(browser), setPublishedGame(browser)]);
  } catch (err) {
    console.log("Global error:", err.message);
    process.exit(1);
  } finally {
    await browser.close().catch(() => {});
  }
})();
