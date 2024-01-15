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
let initialCanvasHeightWithOffset = 0;
let initialCanvasWidthWithOffset = 0;
let currentFactor = 0.5;
const outerMarginX = 400;
const outerMarginY = 400;
const pix = window.devicePixelRatio;

document.addEventListener(
    'DOMContentLoaded',
    function () {
        const fileInput = document.getElementById('fileInput');
        fileInput.value = null;
        const canvasContainer = document.querySelector('.canvas-container');
        const loader = document.querySelector('.loader');
        canvasContainer.appendChild(loader);
    },
    false
);

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
                        scale: pix * multiplier,
                    });
                    // Prepare canvas using PDF page dimensions
                    const canvasContainer =
                        document.querySelector('.canvas-container');
                    canvasContainer.classList.add('visible');
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    initialCanvasHeight = canvas.height / pix;
                    initialCanvasWidth = canvas.width / pix;
                    initialCanvasHeightWithOffset =
                        initialCanvasHeight + outerMarginY;
                    initialCanvasWidthWithOffset =
                        initialCanvasWidth + outerMarginX;
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
    const scale = 1 / pix;
    return (await printPDF(pdfData)).map(async (c) => {
        canvas.add(
            new fabric.Image(await c, {
                scaleX: scale,
                scaleY: scale,
            })
        );
    });
}

const canvas = (_this.__canvas = new fabric.Canvas('c'));

function addMarginToCanvas() {
    canvas.setWidth(initialCanvasWidthWithOffset);
    canvas.setHeight(initialCanvasHeightWithOffset);
    canvas.requestRenderAll();
}

document.querySelector('input').addEventListener('change', async (e) => {
    await displayPdf(e);
    addMarginToCanvas();
    drawBorderRectangle();
    centerAllObjects();
    zoomCanvasSmall();
    canvas.requestRenderAll();
    showPage(docIndex);
});

async function displayPdf(e) {
    canvas.preserveObjectStacking = true;
    const text = new fabric.Text('Upload PDF');
    text.set('text', 'loading...');
    await pdfToImage(e.target.files[0], canvas);
    canvas.remove(text);
    canvas.requestRenderAll();
}

function drawBorderRectangle() {
    const rect = new fabric.Rect({
        left: 0,
        top: 0,
        width: initialCanvasWidth,
        height: initialCanvasHeight,
        stroke: 'red',
        strokeWidth: 3,
        fill: 'transparent',
        selectable: false,
        evented: false,
    });
    canvas.add(rect);
    rect.bringToFront();
}

function showPage(index) {
    const pages = canvas.getObjects('image');
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

document.getElementById('next').onclick = increaseIndex;
function increaseIndex() {
    if (docIndex < numPages - 1) {
        docIndex += 1;
        showPage(docIndex);
    }
}

document.getElementById('prev').onclick = decreaseIndex;
function decreaseIndex() {
    if (docIndex > 0) {
        docIndex -= 1;
        showPage(docIndex);
    }
}

function cropCanvas() {
    zoomCanvasHuge();
    canvas.setWidth(canvas.width - outerMarginY);
    canvas.setHeight(canvas.height - outerMarginY);
    const pages = canvas.getObjects('image');
    pages.forEach((page) => {
        const currentLeft = page.get('left');
        const currentTop = page.get('top');
        const newLeft = currentLeft - outerMarginY / 2;
        const newTop = currentTop - outerMarginX / 2;
        page.set({ left: newLeft, top: newTop });
    });
    canvas.renderAll();
}

function uncropCanvas() {
    canvas.setWidth(canvas.width + outerMarginY);
    canvas.setHeight(canvas.height + outerMarginY);
    const pages = canvas.getObjects('image');
    pages.forEach((page) => {
        const currentLeft = page.get('left');
        const currentTop = page.get('top');
        const newLeft = currentLeft + outerMarginY / 2;
        const newTop = currentTop + outerMarginX / 2;
        page.set({ left: newLeft, top: newTop });
    });
    zoomCanvas(currentFactor);
    canvas.renderAll();
}

document.getElementById('double').onclick = toggleZoom;
function toggleZoom() {
    if (canvas.getZoom() === 0.5) {
        zoomCanvasSmall();
    } else {
        zoomCanvasActual();
    }
}

function zoomCanvas(factor) {
    if (factor != 1) {
        currentFactor = factor;
    }
    canvas.setZoom(factor);
    canvas.setHeight(initialCanvasHeightWithOffset * factor);
    canvas.setWidth(initialCanvasWidthWithOffset * factor);
    canvas.renderAll();
}

function zoomCanvasHuge() {
    zoomCanvas(1);
}

function zoomCanvasActual() {
    zoomCanvas(0.5);
}

function zoomCanvasSmall() {
    zoomCanvas(0.25);
}

function centerAllObjects() {
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
        canvas.viewportCenterObject(obj);
    });
}

function hideRectangles() {
    const rectangles = canvas.getObjects('rect');
    rectangles.forEach((rectangle) => {
        rectangle.visible = false;
    });
    canvas.renderAll();
}

function showRectangles() {
    const rectangles = canvas.getObjects('rect');
    rectangles.forEach((rectangle) => {
        rectangle.visible = true;
    });
    canvas.renderAll();
}

document.getElementById('download').onclick = saveImage;
function saveImage() {
    canvas.discardActiveObject().renderAll();
    hideRectangles();
    cropCanvas();
    const image = canvas
        .toDataURL({
            format: 'image/png',
            multiplier: 1,
        })
        .replace('image/png', 'image/octet-stream');
    uncropCanvas();
    showRectangles();
    const link = document.createElement('a');
    const random = Math.floor(Math.random() * 1000);
    link.download = `my-image-${random}.png`;
    link.href = image;
    link.click();
}

function createBase64() {
    canvas.discardActiveObject().renderAll();
    hideRectangles();
    cropCanvas();
    const image = canvas.toDataURL({
        multiplier: 1,
    });
    uncropCanvas();
    showRectangles();
    return image;
}

function setIsLoading() {
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.classList.add('loading');
}

function unsetIsLoading() {
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.classList.remove('loading');
}

document.getElementById('dumpBase64').onclick = dumpBase64;

function dumpBase64() {
    const pages = canvas.getObjects('image');
    const outputArea = document.getElementById('outputArea');
    pages.forEach((_, i) => {
        showPage(i);
        const base64 = createBase64();
        const outputImage = document.createElement('img');
        outputImage.classList.add('output-image');
        outputImage.src = base64;
        outputArea.appendChild(outputImage);
    });
}
