import './styles/style.scss';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
import { fabric } from 'fabric';

const Base64Prefix = 'data:application/pdf;base64,';
const _this = Window;
let docIndex = 0;
let numPages = 0;
let initialCanvasHeight = 0;
let initialCanvasWidth = 0;
const outerMarginX = 100;
const outerMarginY = 100;

fabric.Object.prototype.set({
    transparentCorners: false,
    borderColor: '#ff00ff',
    cornerColor: '#ff0000',
});

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
        numPages = pdf.numPages;
        const pagePromises = Array(numPages)
            .fill(0)
            .map((__, i) => {
                const pageNumber = i + 1;
                if (pages && pages.indexOf(pageNumber) == -1) {
                    return;
                }
                return pdf.getPage(pageNumber).then((page) => {
                    const multiplier = 4;
                    const viewport = page.getViewport({
                        scale: window.devicePixelRatio * multiplier,
                    });
                    // Prepare canvas using PDF page dimensions
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    initialCanvasHeight = canvas.height;
                    initialCanvasWidth = canvas.width;
                    // Render PDF page into canvas context
                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport,
                    };
                    const renderTask = page.render(renderContext);
                    return renderTask.promise.then(() => canvas);
                });
            });

        return Promise.all(pagePromises);
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
        showPage(docIndex);
    });
}

const canvas = (_this.__canvas = new fabric.Canvas('c'));
const text = new fabric.Text('Upload PDF');
document.querySelector('input').addEventListener('change', async (e) => {
    text.set('text', 'loading...');
    canvas.requestRenderAll();
    await pdfToImage(e.target.files[0], canvas);
    canvas.remove(text);
});

function showPage(index) {
    const pages = canvas.getObjects();
    pages.forEach((page, i) => {
        if (i === index) {
            page.visible = true;
        } else {
            page.visible = false;
        }
    });
    canvas.discardActiveObject();
    canvas.renderAll();
}

document.getElementById('increaseIdx').onclick = increaseIndex;
function increaseIndex() {
    console.log(docIndex);
    if (docIndex < numPages - 1) {
        docIndex += 1;
        showPage(docIndex);
    }
}

document.getElementById('decreaseIdx').onclick = decreaseIndex;
function decreaseIndex() {
    console.log(docIndex);
    if (docIndex > 0) {
        docIndex -= 1;
        showPage(docIndex);
    }
}

document.getElementById('getObjects').onclick = getAllObjects;
function getAllObjects() {
    const objects = canvas.getObjects();
    console.log(console.log(objects));
}

document.getElementById('chopRight').onclick = chopRight;
function chopRight() {
    canvas.setWidth(canvas.width - 100);
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
        const currentLeft = obj.get('left');
        const newLeft = currentLeft - 50;
        console.log(newLeft);
        obj.set({ left: newLeft });
    });
}

document.getElementById('double').onclick = toggleZoom;
function toggleZoom() {
    if (canvas.getZoom() === 1) {
        zoomCanvas(0.5);
    } else {
        zoomCanvas(1);
    }
    canvas.renderAll();
}

function zoomCanvas(factor) {
    canvas.setZoom(factor);
    canvas.setHeight(initialCanvasHeight * factor);
    canvas.setWidth(initialCanvasWidth * factor);
}

document.getElementById('download').onclick = saveImage;
function saveImage() {
    canvas.discardActiveObject().renderAll();
    const image = canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
    const link = document.createElement('a');
    const random = Math.floor(Math.random() * 1000);
    link.download = `my-image-${random}.png`;
    link.href = image;
    link.click();
}
