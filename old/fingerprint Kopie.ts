export default class Fingerprinter {
    public static hasAlpha(data: Uint8ClampedArray): boolean {
        for (let i=3; i<data.length; i+=4)
            if (data[i] !== 255) 
                return true;
        return false;
    }

    public static async getDataFromImage(source: any): Promise<ImageData> {
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

    public static async getImageFromData(data: ImageData): Promise<HTMLImageElement> {
        const canvas = document.createElement("canvas");
        const image = new Image();
        const ctx = canvas.getContext("2d");
        canvas.width = data.width;
        canvas.height = data.height;
        ctx.putImageData(data, 0, 0);
        return await new Promise(resolve => {
            canvas.toBlob((blob: Blob)=>{
                image.onload = () => resolve(image);
                image.src = URL.createObjectURL(blob);
            })
        });
    }

    public static extensionHasAlphaChannel(source: string): boolean {
        return ["png", "icn"].some((ext: string) => source.endsWith(`.${ext}`));
    }

    public static async steg(   image: string | HTMLImageElement, 
                                data: string, 
                                options: { hasAlphaChannel?: boolean } = { hasAlphaChannel: true }): Promise<{modifiedImage: HTMLImageElement, originalImage: HTMLImageElement}> {
        const source = typeof image === "string" ? image : image.src;
        const sourceData = await fetch(source);
        const blob = await sourceData.blob();
        const imageData = await this.getDataFromImage(URL.createObjectURL(blob));
        const array = new Uint8ClampedArray(imageData.data);
        const binary = new TextEncoder().encode(`${data}\0`);
        options.hasAlphaChannel = options.hasAlphaChannel || this.extensionHasAlphaChannel(source) || this.hasAlpha(array);
        
        for (var i=0, index=0; i<array.length; i++) {
            if (i % 4 === 3) continue;
            else if (options.hasAlphaChannel) {
                const pixelId = Math.floor(i / 4);
                const pixelAlphaIndex = pixelId + (4 - i % 4);
                if (array[pixelAlphaIndex] === 0)
                    continue;
            }
            index++;
            if (index > binary.length * 8) break;
            const pos = index % 8;
            const val = (1 << pos & binary[Math.floor(index / 8)]) !== 0;
            val ? array[i] |= 1 : array[i] &= ~1;
        }
        console.log(binary.length * 8 - index + 1, index, array.length);
        imageData.data.set(array)

        const modifiedImage = await this.getImageFromData(imageData);
        const originalImage = new Image();
        await new Promise(resolve => {
            originalImage.onload = () => resolve(originalImage);
            originalImage.src = URL.createObjectURL(blob);
        })
        return {
            modifiedImage: modifiedImage,
            originalImage: originalImage
        };
    }
    
    public static async desteg( image: string | HTMLImageElement,
                                options: { hasAlphaChannel?: boolean } = { }): Promise<string> {
        const source = typeof image === "string" ? image : image.src;
        const sourceData = await fetch(source);
        const blob = await sourceData.blob();
        const imageData = await this.getDataFromImage(URL.createObjectURL(blob));
        const array = new Uint8ClampedArray(imageData.data);

        const maxSize = Math.ceil((imageData.width * imageData.height * (4-1)) / 8);
        const data = new Uint8ClampedArray(maxSize).fill(0);
        options.hasAlphaChannel = options.hasAlphaChannel || this.extensionHasAlphaChannel(source) || this.hasAlpha(array);

        for (let i=0, index=0, binary=0; i<maxSize * 8; i++) {
            if (i % 4 === 3)  continue;
            else if (options.hasAlphaChannel) {
                const pixelId = Math.floor(i / 4);
                const pixelAlphaIndex = pixelId + (4 - i % 4);
                if ([0,1,2,3].every(index => array[pixelAlphaIndex-index] === 0))
                    continue;
            }
            index++;
            binary = (array[i] & 1) ? binary | (1 << (index % 8)) : binary & ~(1 << (index % 8));
            if (index % 8 === 7) {
                data[data.indexOf(0)] = options.hasAlphaChannel ? binary >> 1 : binary;
                if (binary === 0) break;
                binary = 0;
            }
        }
        return new TextDecoder().decode(data.slice(0, data.indexOf(0) + 1));
    }
}