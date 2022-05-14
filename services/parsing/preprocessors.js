import { createRequire } from "module";
const require = createRequire(import.meta.url);

const htmlparser2 = require("htmlparser2");
import { promises as fsp } from "fs";
import path from "path";
import { load as loadCheerio } from "cheerio";
import css from "css";
import { generateRandomString } from "../../utils/randomGenerator";
import { WEBSITE_PATH } from "../../sharedConstants";

export const WebpageStore = new Map();
const attributeSelectors = new Map();

const preprocessSelector = (selector) => {
  const matchedValues = selector.match(/\[(class|id).=.+\]/g);

  if (matchedValues) {
    const updatedSelector = matchedValues.reduce((selectorToModify, value) => {
      !attributeSelectors.has(value) &&
        attributeSelectors.set(value, `data-${generateRandomString()}`);

      return selectorToModify.replaceAll(
        value,
        `[${attributeSelectors.get(value)}]`
      );
    }, selector);

    return updatedSelector;
  }

  return selector;
};

export const preprocessHtml = async (htmlFilePath) => {
  const rawHtml = await fsp.readFile(htmlFilePath, "utf-8");
  const dom = htmlparser2.parseDocument(rawHtml);
  const $ = loadCheerio(dom, { _useHtmlParser2: true });

  const cssPaths = [];
  $('head > [rel="stylesheet"]').each(async function () {
    const cssPath = $(this).attr("href");
    if (!cssPath.includes("css/styles.css")) {
      return true;
    }

    const relativePathPart = cssPath.lastIndexOf("../");
    if (relativePathPart > -1) {
      cssPaths.push(cssPath.slice(relativePathPart + 3));
    } else {
      cssPaths.push(cssPath);
    }
  });

  for (let index = 0; index < cssPaths.length; index++) {
    try {
      const cssPath = cssPaths[index];
      const cssFilePath = path.join(WEBSITE_PATH, cssPath);
      const rawCss = await fsp.readFile(cssFilePath, "utf-8");
      const astCssObject = css.parse(rawCss);

      for (
        let index = 0;
        index < astCssObject.stylesheet.rules.length;
        index++
      ) {
        const rule = astCssObject.stylesheet.rules[index];

        switch (rule.type) {
          case "rule":
            rule.selectors = rule.selectors.map(preprocessSelector);
            break;
          case "media":
            rule.rules.forEach((mediaRule) => {
              mediaRule.selectors = mediaRule.selectors.map(preprocessSelector);
            });
        }
      }

      const cssString = css.stringify(astCssObject);
      WebpageStore.set(cssFilePath, cssString);
      await fsp.writeFile("preprocessed_css.css", cssString);
    } catch (err) {
      console.error(
        "An error has occurred while preprocessing HTML related css files",
        err
      );
    }
  }

  attributeSelectors.forEach((dataAttribute, attributeSelector) => {
    try {
      $(attributeSelector).each(function () {
        $(this).attr(dataAttribute, "");
      });
    } catch (e) {
      console.error(e);
    }
  });

  const htmlString = $.html();
  WebpageStore.set(htmlFilePath, htmlString);
  await fsp.writeFile("preprocessed_html.html", htmlString);

  return htmlString;
};

export const preprocessCss = async (cssFilePath) => {
  try {
    const rawCss = await fsp.readFile(cssFilePath, "utf-8");
    WebpageStore.set(cssFilePath, rawCss);

    return rawCss;
  } catch (err) {
    console.error("An error occurred while preprocessing css file", err);
  }
};
