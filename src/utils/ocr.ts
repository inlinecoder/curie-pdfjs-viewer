import {
  createWorker,
  type RecognizeResult,
} from 'tesseract.js';

export type ImageMetadata = {
  width: number;
  height: number;
};

export type OcrWordBlock = {
  indexInParent: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  paragraphNumber: number,
  lineNumber: number,
};

export type OcrResultSimplified = {
  imageMetadata: ImageMetadata;
  text: string;
  wordBlocks: OcrWordBlock[];
};

function normalizeWordBlockCoordinates(wordBlocks: OcrWordBlock[]): OcrWordBlock[] {
  const resultWordBlocks: OcrWordBlock[] = [];

  let commonY1 = Infinity;
  let commonY2 = -Infinity;
  let wordBlockInLine: OcrWordBlock[] = [];

  let currentParagraphNumber = -1;
  let currentLineNumber = -1;

  const flushWordBlocksInLine = () => {
    wordBlockInLine.forEach((wordBlockInLine) => {
      resultWordBlocks.push({
        ...wordBlockInLine,
        y0: commonY1,
        y1: commonY2,
      });
    });

    commonY1 = Infinity;
    commonY2 = -Infinity;
    wordBlockInLine = [];
  };

  for (let wordBlockIndex = 0; wordBlockIndex < wordBlocks.length; wordBlockIndex++) {
    const currentWordBlock = wordBlocks[wordBlockIndex];

    if (currentWordBlock.lineNumber !== currentLineNumber
      || currentWordBlock.paragraphNumber !== currentParagraphNumber
    ) {
      flushWordBlocksInLine();
    }

    commonY1 = Math.min(commonY1, currentWordBlock.y0);
    commonY2 = Math.max(commonY2, currentWordBlock.y1);

    currentLineNumber = currentWordBlock.lineNumber;
    currentParagraphNumber = currentWordBlock.paragraphNumber;
    wordBlockInLine.push(currentWordBlock);
  }

  flushWordBlocksInLine();

  return resultWordBlocks;
}

function convertRecognizeResultToOcrSimplifiedResult(
  imageMetadata: ImageMetadata,
  recognizeResult: RecognizeResult,
): OcrResultSimplified {
  const ocrResultSimplified: OcrResultSimplified = {
    imageMetadata,
    text: recognizeResult.data.text,
    wordBlocks: [],
  };

  recognizeResult.data.blocks
    ?.forEach((block) => {
      block.paragraphs
        .forEach((paragraph, paragraphIndex) => {
          paragraph.lines
            .forEach((line, lineIndex) => {
              line.words
                .forEach((word) => {
                  ocrResultSimplified.wordBlocks.push({
                    indexInParent: ocrResultSimplified.wordBlocks.length,
                    text: word.text,
                    x0: word.bbox.x0,
                    y0: word.bbox.y0,
                    x1: word.bbox.x1,
                    y1: word.bbox.y1,
                    paragraphNumber: paragraphIndex,
                    lineNumber: lineIndex,
                  });
                });
            });
        });
    });

  ocrResultSimplified.wordBlocks = normalizeWordBlockCoordinates(ocrResultSimplified.wordBlocks);

  return ocrResultSimplified;
}

export async function ocr(
  canvasElement: HTMLCanvasElement,
  onProgress?: (completionPercentage: number) => void,
): Promise<OcrResultSimplified> {

  const downscaleFactor = 2;

  const scaledCanvas = document.createElement ('canvas') as HTMLCanvasElement;
  scaledCanvas.width = canvasElement.width / downscaleFactor;
  scaledCanvas.height = canvasElement.height / downscaleFactor;
  const scaledCanvasContext = scaledCanvas.getContext('2d')!;
  scaledCanvasContext.drawImage(
    canvasElement,
    0,
    0,
    canvasElement.width,
    canvasElement.height,
    0,
    0,
    scaledCanvas.width,
    scaledCanvas.height
  );

  const worker = await createWorker(['eng', 'rus'], undefined, {
    logger: (m) => {
      if (m.status !== 'recognizing text') {
        return;
      }
      const progressAsPercentage = Number(Number.parseFloat((100 * m.progress).toFixed(0)));
      onProgress?.(progressAsPercentage);
    },
  });

  onProgress?.(0);
  const ret = await worker.recognize(scaledCanvas, {}, {
    blocks: true,
    layoutBlocks: true,
  });
  onProgress?.(100);

  await worker.terminate();

  return convertRecognizeResultToOcrSimplifiedResult(
    {
      width: scaledCanvas.width,
      height: scaledCanvas.height,
    },
    ret,
  );
}