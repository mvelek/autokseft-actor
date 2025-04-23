import { Dataset, createPuppeteerRouter } from "crawlee";

export const router = createPuppeteerRouter();

router.addDefaultHandler(async ({ page, request, enqueueLinks, log }) => {
    await page.waitForSelector(".cookie-bar.cookie-bar-simple");
    const consentButton = await page.$(
        ".btn.btn-primary.text-uppercase.cookies-accept.ga_event"
    );
    consentButton.click();

    // add all products
    const products = await enqueueLinks({
        label: `detail`,
        selector: "a.img",
    });

    await page.waitForSelector("ul.pagination");
    const infos = await enqueueLinks({
        label: "next-page",
        selector: ".pagination-next a",
    });
});

router.addHandler("next-page", async ({ page, request, enqueueLinks, log }) => {
    // add all products
    const products = await enqueueLinks({
        label: `detail`,
        selector: "a.img",
    });

    await page.waitForSelector("ul.pagination");
    const infos = await enqueueLinks({
        label: "next-page",
        selector: ".pagination-next a",
    });
});

router.addHandler("detail", async ({ request, page, log, pushData }) => {
    // console.log(request.loadedUrl);

    // const title = await page.title();
    await page.waitForSelector("span.price");

    // tohle funguje !! - start
    const price = await page.$eval(".price", (pElement) => {
        return pElement.innerHTML;
    });
    // tohle funguje !! - end
    let prodInfo = {};
    const title = await page.$eval("h1#spareparts_heading", (el) => {
        return el.textContent;
    });
    prodInfo.title = title;
    // add ean
    const pdetParametryElement = await page.evaluate(() => {
        const element = document.querySelector(".pdetParametry");
        if (element) {
            return Array.from(element.querySelectorAll("tr"), (el) => {
                const key = el.querySelector("td:nth-child(1)");
                const value = el.querySelector("td:nth-child(2)");
                let m = {};
                return `${key?.textContent}**${value?.textContent}`;
            });
        }
        return;
    });

    for (const s of pdetParametryElement) {
        const parts = s.split("**");
        let name;
        switch (parts[0]) {
            case "Výrobce:":
                name = "manufacturer";
                break;
            case "Kód:":
                name = "code";
                break;

            default:
                name = null;
                break;
        }
        if (name) {
            prodInfo[name] = parts[1];
        }
    }

    const psubParametryElement = await page.evaluate(() => {
        const element = document.querySelector(".psubParametry");
        if (element) {
            return Array.from(element.querySelectorAll("tr"), (el) => {
                const key = el.querySelector("td:nth-child(1)");
                const value = el.querySelector("td:nth-child(2)");
                if (key?.textContent == "EAN:") {
                    let m = {};
                    return `EAN**${value?.textContent}`;
                }
                return;
            }).filter((n) => n);
        }
        return;
    });
    // console.log(psubParametryElement);

    // add concurent numbers
    const concurentCodes = await page.evaluate(async () => {
        const element = document.querySelector(".block.concurent_codes");
        if (element) {
            let lastBrand;
            return Array.from(
                element.querySelectorAll("span.span_row"),
                (el) => {
                    let data = {};
                    const brand = el.querySelector("span.crit_name ");
                    data.brand = brand?.textContent || lastBrand;
                    lastBrand = brand?.textContent || lastBrand;

                    const concurentCode = el.querySelector("span.crit_value ");
                    console.log(concurentCode.textContent);
                    data.concurentCode = concurentCode.textContent;
                    return data;
                }
            );
        }
        return;
    });

    // add oem numbers
    const oemCodes = await page.evaluate(async () => {
        const element = document.querySelector(".block.oe-numbers-block");
        if (element) {
            let lastBrand;
            return Array.from(
                element.querySelectorAll("span.span_row"),
                (el) => {
                    let data = {};
                    const brand = el.querySelector("span.crit_name ");
                    data.brand = brand?.textContent || lastBrand;
                    lastBrand = brand?.textContent || lastBrand;

                    const oemCode = el.querySelector("span.crit_value ");
                    data.oemCode = oemCode.textContent;
                    return data;
                }
            );
        }
        return;
    });

    // console.log(oemCodes);
    // add spare parts numbers
    const sparePartsProducts = await page.evaluate(async () => {
        return Array.from(
            document.querySelectorAll("li.spareparts_product"),
            (el) => {
                const artnr = el.querySelector(".artnr ");
                return artnr.textContent;
            }
        );
    });

    // save product data
    // add prod info
    await pushData(
        {
            url: request.loadedUrl,
            code: prodInfo.code,
            brand: prodInfo.manufacturer,
            priceTxt: price,
            price: parseFloat(
                price.replace(",-", ".00").replaceAll("&nbsp;", "")
            ), //parse price to number
            title: prodInfo.title,
            timestamp: +new Date(),
        },
        "autokseft-product"
    );

    // save oem codes data
    // add product code to each record
    if (concurentCodes) {
        for (const codeItem of concurentCodes) {
            await pushData(
                {
                    code: prodInfo.code,
                    manufacturer: codeItem.brand,
                    concurentCode: codeItem.concurentCode,
                },
                "autokseft-concurent-codes"
            );
        }
    }

    // add product code to each record
    if (oemCodes) {
        for (const codeItem of oemCodes) {
            await pushData(
                {
                    code: prodInfo.code,
                    manufacturer: codeItem.brand,
                    oemCode: codeItem.oemCode,
                },
                "autokseft-oem-codes"
            );
        }
    }

    if (sparePartsProducts) {
        for (const artNr of sparePartsProducts) {
            await pushData(
                {
                    code: prodInfo.code,
                    spareCode: artNr,
                },
                "autokseft-spare-parts"
            );
        }
    }
});
