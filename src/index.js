import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
import { fabric } from 'fabric';

const Base64Prefix = 'data:application/pdf;base64,';

function readBlob(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result));
        reader.addEventListener('error', reject);
        reader.readAsDataURL(blob);
    });
}

async function printPDF(pdfData, pages) {
    pdfData = pdfData instanceof Blob ? await readBlob(pdfData) : pdfData;
    const data = atob(
        pdfData.startsWith(Base64Prefix)
            ? pdfData.substring(Base64Prefix.length)
            : pdfData
    );
    // Using DocumentInitParameters object to load binary data.
    const loadingTask = pdfjsLib.getDocument({ data });
    return loadingTask.promise.then((pdf) => {
        const numPages = pdf.numPages;
        return new Array(numPages).fill(0).map((__, i) => {
            const pageNumber = i + 1;
            if (pages && pages.indexOf(pageNumber) == -1) {
                return;
            }
            return pdf.getPage(pageNumber).then((page) => {
                //  retina scaling
                const viewport = page.getViewport({
                    scale: window.devicePixelRatio,
                });
                // Prepare canvas using PDF page dimensions
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                // Render PDF page into canvas context
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };
                const renderTask = page.render(renderContext);
                return renderTask.promise.then(() => canvas);
            });
        });
    });
}

async function pdfToImage(pdfData, canvas) {
    const scale = 1 / window.devicePixelRatio;
    return (await printPDF(pdfData)).map(async (c) => {
        canvas.add(
            new fabric.Image(await c, {
                scaleX: scale,
                scaleY: scale,
            })
        );
    });
}

const canvas = (Window.__canvas = new fabric.Canvas('c'));
const text = new fabric.Text('Upload PDF');
document.querySelector('input').addEventListener('change', async (e) => {
    text.set('text', 'loading...');
    canvas.requestRenderAll();
    await Promise.all(pdfToImage(e.target.files[0], canvas));
    canvas.remove(text);
});
