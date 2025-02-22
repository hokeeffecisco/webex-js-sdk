/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-unused-vars: ["error", { "vars": "local" }] */
/* global FileReader */

const {Buffer} = require('safe-buffer');
const {parse} = require('exifr/dist/lite.umd');

/**
* Updates the image file with exif information, required to correctly rotate the image activity
* @param {Object} file
* @param {Object} options
* @param {boolean} options.shouldNotAddExifData
* @returns {Promise<Object>}
*/
export function updateImageOrientation(file, options = {}) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.readAsArrayBuffer(file);
    reader.onload = function onload() {
      const arrayBuffer = reader.result;
      const buf = Buffer.from(arrayBuffer);

      resolve(buf);
    };
  })
    .then((buf) => {
      if (options.shouldNotAddExifData) {
        return buf;
      }

      return readExifData(file, buf);
    });
}

/**
* Adds exif orientation information on the image file
* @param {Object} file
* @param {Object} buf
* @returns {Promise<ExifImage>}
*/
export async function readExifData(file, buf) {
  // For avatar images the file.type is set as image/jpeg, however for images shared in an activity file.mimeType is set as image/jpeg. Handling both conditions.
  if (
    file &&
    (file.type === 'image/jpeg' || file.mimeType === 'image/jpeg')
  ) {
    const exifData = await parse(buf, {translateValues: false});

    if (exifData) {
      const {Orientation, ExifImageHeight, ExifImageWidth} = exifData;

      file.orientation = Orientation;
      file.exifHeight = ExifImageHeight;
      file.exifWidth = ExifImageWidth;

      if (file.image) {
        file.image.orientation = Orientation;
      }
    }
  }

  return buf;
}

/* eslint-disable complexity */
/**
* Rotates/flips the image on the canvas as per exif information
* @param {Object} options(orientation: image exif orientation range from 1-8, img: Image object, x: start x-axis, y: start y-axis, width: width of the thumbnail, height: height of the thumbnail, ctx: canvas context)
* @param {Object} file
* @returns {Object}
*/
export function orient(options, file) {
  const {
    width, height, ctx, img, orientation, x, y
  } = options;

  if (file && file.orientation && file.orientation !== 1) {
    // explanation of orientation:
    // https://stackoverflow.com/questions/20600800/js-client-side-exif-orientation-rotate-and-mirror-jpeg-images
    switch (orientation) {
      case 2:
        // flip
        ctx.transform(-1, 0, 0, 1, width, 0);
        break;
      case 3:
      // rotateImage180
        ctx.transform(-1, 0, 0, -1, width, height);
        break;
      case 4:
      // rotate180AndFlipImage
        ctx.transform(1, 0, 0, -1, 0, height);
        break;
      case 5:
      // rotate90AndFlipImage
        ctx.transform(0, 1, 1, 0, 0, 0);
        break;
      case 6:
      // rotateImage90
        ctx.transform(0, 1, -1, 0, height, 0);
        break;
      case 7:
      // rotateNeg90AndFlipImage
        ctx.transform(0, -1, -1, 0, height, width);
        break;
      case 8:
      // rotateNeg90
        ctx.transform(0, -1, 1, 0, 0, width);
        break;
      default:
        break;
    }
  }
  ctx.drawImage(img, x, y, width, height);
}
/* eslint-enable complexity */

export {default as processImage} from './process-image';
export {default as detectFileType} from './detect-filetype';
