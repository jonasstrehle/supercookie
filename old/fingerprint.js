import Jimp from "jimp";
export default class Fingerprinter {
    static hasAlpha(data) {
        for (let i = 3; i < data.length; i += 4)
            if (data[i] !== 255)
                return true;
        return false;
    }
    static async getDataFromImage(source) {
        const image = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const { width, height } = await new Promise(resolve => {
            image.onload = () => resolve({
                width: image.width,
                height: image.height
            });
            image.src = source;
        });
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, width, height);
    }
    static async getImageFromData(data) {
        const canvas = document.createElement("canvas");
        const image = new Image();
        const ctx = canvas.getContext("2d");
        canvas.width = data.width;
        canvas.height = data.height;
        ctx.putImageData(data, 0, 0);
        return await new Promise(resolve => {
            canvas.toBlob((blob) => {
                image.onload = () => resolve(image);
                image.src = URL.createObjectURL(blob);
            });
        });
    }
    static extensionHasAlphaChannel(source) {
        return ["png", "icn"].some((ext) => source.endsWith(`.${ext}`));
    }
    static async steg(source, data, options = { hasAlphaChannel: true }) {
        const image = await Jimp.read(source);
        image.filterType(Jimp.PNG_FILTER_NONE);
        image.deflateStrategy(0);
        const imageData = image.bitmap.data;
        const array = new Uint8ClampedArray(imageData);
        const binary = new TextEncoder().encode(`${data}\0`);
        options.hasAlphaChannel = options.hasAlphaChannel || this.extensionHasAlphaChannel(source) || this.hasAlpha(array);
        for (var i = 0, index = 0; i < array.length; i++) {
            if (i % 4 === 3)
                continue;
            else if (options.hasAlphaChannel) {
                const pixelId = Math.floor(i / 4);
                const pixelAlphaIndex = pixelId + (4 - i % 4);
                if (array[pixelAlphaIndex] === 0)
                    continue;
            }
            index++;
            if (index > binary.length * 8)
                break;
            const pos = index % 8;
            const val = (1 << pos & binary[Math.floor(index / 8)]) !== 0;
            val ? array[i] |= 1 : array[i] &= ~1;
        }
        image.bitmap.data.set(array);
        return await image.getBufferAsync(image.getMIME());
    }
}
