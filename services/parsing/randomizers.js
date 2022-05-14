import { createRequire } from "module";
const require = createRequire(import.meta.url);

const htmlparser2 = require("htmlparser2");
import { promises as fsp } from "fs";
import path from "path";
import { load as loadCheerio } from "cheerio";
import pkg from "javascript-obfuscator";
const { obfuscate } = pkg;
import css from "css";
import * as CSSwhat from "css-what";
import LRU from "lru-cache";
import { cryptoService } from "../cryptography";
import {
  BUFFER_ENCODING,
  FIRST_REQUEST_COOKIE,
  HTML_ELEMENTS,
  PRIVATE_KEY,
  PROXY_ADDRESS,
  PUBLIC_KEY,
  WEBSITE_PATH,
} from "../../sharedConstants";
import { preprocessCss, preprocessHtml, WebpageStore } from "./preprocessors";

const crypto = cryptoService(PUBLIC_KEY, PRIVATE_KEY, "top secret");

const idClassMapsCache = new LRU({
  max: 500,
});

export const randomizeHtml = async (relativePath, config = {}) => {
  config = {
    overrideClassNameSelector: true,
    overrideIdSelector: true,
    ...config,
  };

  const filePath = path.join(WEBSITE_PATH, relativePath);
  const rawHtml = WebpageStore.has(filePath)
    ? WebpageStore.get(filePath)
    : await preprocessHtml(filePath);
  const dom = htmlparser2.parseDocument(rawHtml);

  try {
    const $ = loadCheerio(dom, { _useHtmlParser2: true });

    $("small").text("We dislike being scraped!");

    const classMap = {};
    const idMap = {};

    $("[href]").each(function () {
      const hrefAttrValue = $(this).attr("href");

      if (hrefAttrValue.startsWith("http")) {
        return true;
      }

      const finalHrefAttrValue =
        hrefAttrValue.includes("./") || hrefAttrValue[0] !== "/"
          ? path
              .join(
                relativePath.slice(0, relativePath.lastIndexOf("/")),
                hrefAttrValue
              )
              .replaceAll("\\", "/")
          : hrefAttrValue;

      const encryptedHrefAttrValue = crypto
        .encryptText(finalHrefAttrValue)
        .toString(BUFFER_ENCODING);
      const encryptedUrl = `${PROXY_ADDRESS}/${encryptedHrefAttrValue}`;
      $(this).attr("href", encryptedUrl);
    });

    $("[class]").each(function () {
      const classAttrValues = $(this).attr("class").split(" ");

      const encryptedClassAttrValue = classAttrValues
        .map((value) => {
          if (HTML_ELEMENTS.has(value) || value.includes(":")) return value;

          const encryptedValue = crypto
            .encryptText(value)
            .toString(BUFFER_ENCODING);

          if (!classMap[value]) {
            classMap[value] = encryptedValue.substring(0, 10);
          }

          return classMap[value];
        })
        .join(" ");

      $(this).attr("class", encryptedClassAttrValue);
    });

    $("[id]").each(function () {
      const idAttrValue = $(this).attr("id");

      const encryptedIdAttrValue = crypto
        .encryptText(idAttrValue)
        .toString(BUFFER_ENCODING);

      if (!idMap[idAttrValue]) {
        idMap[idAttrValue] = encryptedIdAttrValue.substring(0, 10);
      }

      $(this).attr("id", idMap[encryptedIdAttrValue]);
    });

    fsp.writeFile("dummy_class_map.txt", JSON.stringify(classMap, null, 2));
    fsp.writeFile("dummy_id_map.txt", JSON.stringify(idMap, null, 2));

    const classMapInBase64url = Buffer.from(JSON.stringify(classMap)).toString(
      BUFFER_ENCODING
    );
    const idMapInBase64url = Buffer.from(JSON.stringify(idMap)).toString(
      BUFFER_ENCODING
    );

    const dateOfCaching = Date.now();
    idClassMapsCache.set(dateOfCaching, { classMap, idMap });

    const obfuscatedGetElementById =
      obfuscate(`var input = \`${idMapInBase64url}\`;
      input = input.replace(/-/g, "+").replace(/_/g, "/");
      var pad = input.length % 4;
      if (pad && pad !== 1) {
        input += new Array(5 - pad).join("=");
      }
      var selectorMap = JSON.parse(atob(input));
    
      var byId = document.__proto__.getElementById;
      document.__proto__.getElementById = function (_id) {
        if (selectorMap[_id]) {
          console.log("selectorMap[id]", selectorMap[_id]);
          return byId.call(document, selectorMap[_id]);
        } else {
          console.log("id", _id);
          return byId.call(document, _id);
        }
      };`);

    const overrideGetElementById = `<script type="text/javascript">
    ${obfuscatedGetElementById.getObfuscatedCode()}
    </script>`;

    const obfuscatedGetElementsByClassName =
      obfuscate(`var input = \`${classMapInBase64url}\`;
    input = input.replace(/-/g, "+").replace(/_/g, "/");
    var pad = input.length % 4;
    if (pad && pad !== 1) {
      input += new Array(5 - pad).join("=");
    }
    var selectorMap = JSON.parse(atob(input));
    console.log(selectorMap['btn'], selectorMap['btn'])

    var byClass = document.__proto__.getElementsByClassName;
    document.__proto__.getElementsByClassName = function (_class) {
      if (selectorMap[_class]) {
        console.log("selectorMap[class]", selectorMap[_class]);
        return byClass.call(document, selectorMap[_class]);
      } else {
        console.log("class", _class);
        return byClass.call(document, _class);
      }
    };`);

    const overrideGetElementsByClassName = `<script type="text/javascript">
    ${obfuscatedGetElementsByClassName.getObfuscatedCode()}
    </script>`;

    config.overrideIdSelector && $("head").prepend(overrideGetElementById);
    config.overrideClassNameSelector &&
      $("head").prepend(overrideGetElementsByClassName);

    return {
      dateOfCaching,
      htmlString: $.html(),
    };
  } catch (e) {
    console.error(
      "An error occurred while randomizing html class/id attributes",
      e
    );

    return undefined;
  }
};

const randomizeSelectorWithMappings =
  ({ classMap, idMap }) =>
  (selector) => {
    if (!selector.includes(".") && !selector.includes("#")) return selector;

    const astSelectorObject = CSSwhat.parse(selector);

    // TODO: already comma separated by css.parse; consider astSelectorObject[0]
    const modifiedAstSelectorObject = astSelectorObject.map(
      (commaSeparatedSelector) =>
        commaSeparatedSelector.map((selectorToken) => {
          if (selectorToken.type !== "attribute") return selectorToken;

          if (selectorToken.name === "class") {
            const encryptedClassAttributeValue = classMap[selectorToken.value];

            if (encryptedClassAttributeValue) {
              selectorToken.value = encryptedClassAttributeValue;
            }
          }

          if (selectorToken.name === "id") {
            const encryptedIdAttributeValue = idMap[selectorToken.value];

            if (encryptedIdAttributeValue) {
              selectorToken.value = encryptedIdAttributeValue;
            }
          }

          return selectorToken;
        })
    );

    return CSSwhat.stringify(modifiedAstSelectorObject);
  };

export const randomizeCss = async (relativePath, dateOfCaching) => {
  const filePath = path.join(WEBSITE_PATH, relativePath);
  const rawCss = WebpageStore.has(filePath)
    ? WebpageStore.get(filePath)
    : await preprocessCss(filePath);

  const maps = idClassMapsCache.peek(+dateOfCaching);
  if (!maps) {
    console.error(
      `An error occurred related to the ${FIRST_REQUEST_COOKIE} cookie. Returning unencrypted css file`,
      dateOfCaching
    );

    // TODO: is it a concern to return unencrypted css for mapping between keys?
    return rawCss;
  }

  const randomizeSelector = randomizeSelectorWithMappings(maps);

  try {
    const astCssObject = css.parse(rawCss);

    for (let index = 0; index < astCssObject.stylesheet.rules.length; index++) {
      const rule = astCssObject.stylesheet.rules[index];

      switch (rule.type) {
        case "rule":
          rule.selectors = rule.selectors.map(randomizeSelector);
          break;
        case "media":
          rule.rules.forEach((mediaRule) => {
            mediaRule.selectors = mediaRule.selectors.map(randomizeSelector);
          });
          break;
        // case "font-face":
        //   rule.declarations = rule.declarations.map((declaration) => {
        //     const declarationValue = declaration.value
        //       .split(",")
        //       .map((value) => {
        //         const urlPattern = `url("`;
        //         if (value.trim().startsWith(urlPattern)) {
        //           const start = value.indexOf(urlPattern);
        //           const end = value.indexOf(`")`);
        //           const url = value.slice(start + urlPattern.length + 1, end);

        //           const absolutePathUrl =
        //             value.slice(0, start + urlPattern.length + 1) +
        //             path.join(WEBSITE_PATH, url) +
        //             value.slice(end);
        //           console.log("url path value css ", absolutePathUrl);
        //         }

        //         return value;
        //       })
        //       .join(",");

        //     declaration.value = declarationValue;

        //     return declaration;
        //   });
        //   break;
      }
    }

    return css.stringify(astCssObject);
  } catch (e) {
    console.error(
      "An error occurred while randomizing html class/id attributes",
      e
    );

    return undefined;
  }
};
