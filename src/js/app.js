/* eslint-disable no-undef */

// Set this to true if you want to enable console logging
const DEBUG = false;

// Function for optional console logging
function log(message) {
  if (DEBUG) {
    console.log(message);
  }
}

// Function to extract filename from the div's style attribute
function getFilename(blurredImageDiv) {
  const bgImage = blurredImageDiv.style.backgroundImage;
  const url = bgImage
    .replace('url(', '')
    .replace(')', '')
    .replace(/['"]+/g, '');
  return url.substring(url.lastIndexOf('/') + 1);
}

// Define a function 'loaded' that adds the 'loaded' class to the div
function loaded(event) {
  const imgDiv = event.target.parentElement;
  log(`[${imgDiv.dataset.count}] ✅ Loaded: ${getFilename(imgDiv)}`);
  imgDiv.classList.add('loaded');
}

// Function to process each blurred image div
function processBlurredImage(blurredImageDiv, index) {
  blurredImageDiv.dataset.count = index + 1;
  log(
    `[${blurredImageDiv.dataset.count}] 🔽 Start processing: ${getFilename(
      blurredImageDiv,
    )}`,
  );

  const img = blurredImageDiv.querySelector('img');

  if (!img) {
    log(`  [${blurredImageDiv.dataset.count}] Image not found`);
    return;
  }

  if (img.complete) {
    loaded({ target: img });
  } else {
    img.addEventListener('load', loaded);
    log(`[${blurredImageDiv.dataset.count}] ⚪ Added 'load' event listener`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Fancybox.bind('[data-fancybox="gallery"]', {
    Thumbs: {
      autoStart: false,
    },
  });

  const blurredImageDivs = document.querySelectorAll('.blurred-img');
  log("🟣 Selected all divs with class 'blurred-img'");

  blurredImageDivs.forEach(processBlurredImage);
});
