import { useEffect, useRef, useState, useCallback } from 'react';

import './pdfViewer.css';

import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';

import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

import {
  ocr,
  type OcrWordBlock,
  type OcrResultSimplified,
} from '@/utils/ocr.ts';

function ensurePdfJsWorkerIsInstalled() {
  if (GlobalWorkerOptions.workerSrc) {
    return;
  }

  console.info('Registering PdfJS worker.');
  GlobalWorkerOptions.workerSrc = PdfJsWorker;
}

ensurePdfJsWorkerIsInstalled();

type Props = {
  url: string,
  onIsOcrInProgressChange?: (isOcrInProgress: boolean) => void,
  onOrcProgress?: (completionPercentage: number) => void,
}

export const PdfViewer = (props: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContext = useRef<CanvasRenderingContext2D | null>(null);

  const [isOcrInProgress, setIsOcrInProgress] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResultSimplified | null>(null);
  const [highlightedWordBlockSentenceLikeBoundary, setHighlightedWordBlockSentenceLikeBoundary] = useState<OcrWordBlock[] | null>(null);

  useEffect(() => {
    props.onIsOcrInProgressChange?.(isOcrInProgress);
  }, [isOcrInProgress]);

  const guardCanvas = (): HTMLCanvasElement => {
    if (canvasRef.current === null) {
      throw new Error('Canvas element is not available.');
    }
    return canvasRef.current;
  };

  const guardCanvasContext = (): CanvasRenderingContext2D => {
    if (canvasContext.current === null) {
      throw new Error('Canvas context is not available.');
    }
    return canvasContext.current;
  };

  const cleanupCanvas = useCallback(() => {
    if (canvasContext.current === null) {
      return;
    }

    // TODO: Cleanup
    setOcrResult(null);
    setHighlightedWordBlockSentenceLikeBoundary(null);
  }, []);

  const rescaleWordBlocksWithCanvasDimensions = (
    ocrResultSimplified: OcrResultSimplified,
    withCanvas: HTMLCanvasElement,
  ): OcrResultSimplified => {
    const newScale = withCanvas.offsetWidth / ocrResultSimplified.imageMetadata.width * (window.devicePixelRatio || 1);

    const rescaledResultSimplified: OcrResultSimplified = {
      imageMetadata: {
        width: ocrResultSimplified.imageMetadata.width * newScale,
        height: ocrResultSimplified.imageMetadata.height * newScale,
      },
      text: ocrResultSimplified.text,
      wordBlocks: ocrResultSimplified.wordBlocks
        .map((wordBlock) => {
          return {
            ...wordBlock,
            x0: wordBlock.x0 * newScale,
            y0: wordBlock.y0 * newScale,
            x1: wordBlock.x1 * newScale,
            y1: wordBlock.y1 * newScale,
          };
        }),
    };

    return rescaledResultSimplified;
  };

  const performOcr = useCallback(async (onCanvas: HTMLCanvasElement) => {
    setIsOcrInProgress(true);

    const ocrResultSimplified = await ocr(onCanvas, props.onOrcProgress);
    setOcrResult(rescaleWordBlocksWithCanvasDimensions(ocrResultSimplified, onCanvas));

    setIsOcrInProgress(false);
  }, []);

  const initCanvas = useCallback(async (withPage: PDFPageProxy): Promise<HTMLCanvasElement> => {
    cleanupCanvas();

    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = withPage.getViewport({ scale: pixelRatio });

    canvasContext.current = guardCanvas().getContext('2d');

    const guardedCanvasRef = guardCanvas();
    const guardedCanvasContext = guardCanvasContext();

    guardedCanvasRef.width = viewport.width * pixelRatio;
    guardedCanvasRef.height = viewport.height * pixelRatio;

    guardedCanvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // guardedCanvasRef.style.width = `${viewport.width / pixelRatio}px`;
    // guardedCanvasRef.style.height = `${viewport.height / pixelRatio}px`;

    await withPage.render({
      canvasContext: guardCanvasContext(),
      viewport,
    }).promise;

    return guardedCanvasRef;
  }, []);

  const loadPdf = useCallback(async (url: string): Promise<PDFDocumentProxy> => {
    const doc = getDocument(url);
    return await doc.promise;
  }, []);

  const loadPdfWithOcr = useCallback(async (url: string) => {
    const pdfPage = await (await loadPdf(url)).getPage(1);
    const canvas = await initCanvas(pdfPage);
    await performOcr(canvas);
  }, []);

  const getWordBlockSentenceLikeBoundary = useCallback((forWordBlock: OcrWordBlock): OcrWordBlock[] => {
    if (!ocrResult) {
      throw new Error('Ocr result is not available.');
    }

    const isWordBlocksTooFarApart = (
      wordBlock: OcrWordBlock,
      comparedToWordBlock: OcrWordBlock
    ): boolean => {
      const yAxisDifferenceBetweenWordBlocks = Math.abs(wordBlock.y0 - comparedToWordBlock.y0);
      const wordBlockHeight = wordBlock.y1 - wordBlock.y0;
      const allowedLineHeightRatio = 2;
      return yAxisDifferenceBetweenWordBlocks > (wordBlockHeight * allowedLineHeightRatio);
    };

    const isWordBlocksHeightDifferenceTooBig = (
      wordBlock: OcrWordBlock,
      comparedToWordBlock: OcrWordBlock,
    ): boolean => {
      const allowedHeightDifference = 2;
      return Math.abs((wordBlock.y1 - wordBlock.y0) - (comparedToWordBlock.y1 - comparedToWordBlock.y0)) > allowedHeightDifference;
    };

    const isWordBlockSentenceTerminator = (
      wordBlock: OcrWordBlock,
    ): boolean => {
      const terminators = ['.', '!', '?', ';'];

      const trimmedWordBlockText = wordBlock.text.trim();
      return terminators.includes(trimmedWordBlockText)
        || terminators.includes(trimmedWordBlockText[trimmedWordBlockText.length - 1]);
    };

    const sentenceLikeBlock: OcrWordBlock[] = [];

    let runningWordBlock = forWordBlock;
    for (let wordIndex = forWordBlock.indexInParent - 1; wordIndex >= 0; wordIndex--) {
      const wordBlockToCompareTo = ocrResult.wordBlocks[wordIndex];
      if (isWordBlocksTooFarApart(runningWordBlock, wordBlockToCompareTo)
        || isWordBlocksHeightDifferenceTooBig(runningWordBlock, wordBlockToCompareTo)
        || isWordBlockSentenceTerminator(wordBlockToCompareTo)
      ) {
        break;
      }

      runningWordBlock = wordBlockToCompareTo;
      sentenceLikeBlock.unshift(runningWordBlock);
    }

    sentenceLikeBlock.push(forWordBlock);

    if (!isWordBlockSentenceTerminator(forWordBlock)) {
      runningWordBlock = forWordBlock;
      for (let wordIndex = forWordBlock.indexInParent + 1; wordIndex < ocrResult.wordBlocks.length; wordIndex++) {
        const wordBlockToCompareTo = ocrResult.wordBlocks[wordIndex];
        if (isWordBlocksTooFarApart(runningWordBlock, wordBlockToCompareTo)
          || isWordBlocksHeightDifferenceTooBig(runningWordBlock, wordBlockToCompareTo)
          || isWordBlockSentenceTerminator(wordBlockToCompareTo)
        ) {
          if (isWordBlockSentenceTerminator(wordBlockToCompareTo)) {
            runningWordBlock = wordBlockToCompareTo;
          }
          break;
        }

        runningWordBlock = wordBlockToCompareTo;
        sentenceLikeBlock.push(runningWordBlock);
      }

      if (sentenceLikeBlock[sentenceLikeBlock.length - 1] !== runningWordBlock) {
        sentenceLikeBlock.push(runningWordBlock);
      }
    }

    return sentenceLikeBlock;
  }, [ocrResult]);

  const getSvgPolygonPointsFromSentenceLikeWordBlocks = useCallback((sentenceLikeWordBlocks: OcrWordBlock[]): string => {
    if (sentenceLikeWordBlocks.length === 0) {
      return '';
    }

    const lineGroups = sentenceLikeWordBlocks
      .reduce((groups: { [key: number]: OcrWordBlock[] }, block) => {
        if (!groups[block.lineNumber]) {
          groups[block.lineNumber] = [];
        }
        groups[block.lineNumber].push(block);
        return groups;
      }, {});

    return Object.values(lineGroups)
      .map(lineBlocks => {
        const minX = Math.min(...lineBlocks.map(block => block.x0));
        const maxX = Math.max(...lineBlocks.map(block => block.x1));
        const minY = Math.min(...lineBlocks.map(block => block.y0));
        const maxY = Math.max(...lineBlocks.map(block => block.y1));

        return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
      })
      .join(' ');
  }, []);

  useEffect(() => {
    loadPdfWithOcr(props.url);
  }, [props.url]);

  const handleWordBlockHover = useCallback((wordBlock: OcrWordBlock) => {
    setHighlightedWordBlockSentenceLikeBoundary(getWordBlockSentenceLikeBoundary(wordBlock));
  }, [ocrResult]);

  return <div className={'pdf-viewer-component flex-1 relative'}>
    <div className={'absolute inset-0'}>
      {ocrResult &&
        <svg
          className={'w-full h-full'}
          viewBox={`0 0 ${ocrResult.imageMetadata.width} ${ocrResult.imageMetadata.height}`}
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          {highlightedWordBlockSentenceLikeBoundary &&
            <path
              className={'word-block-sentence-like-boundary fill-blue-600/20'}
              d={getSvgPolygonPointsFromSentenceLikeWordBlocks(highlightedWordBlockSentenceLikeBoundary)}
            />
          }
          {ocrResult.wordBlocks.map((wordBlock) => {
            return <rect
              key={wordBlock.indexInParent}
              className={'word-block'}
              x={wordBlock.x0 - 1}
              y={wordBlock.y0 - 2}
              width={wordBlock.x1 - wordBlock.x0 + 2}
              height={wordBlock.y1 - wordBlock.y0 + 4}
              rx='10'
              ry='10'
              onMouseEnter={() => handleWordBlockHover(wordBlock)}
            />;
          })}
        </svg>
      }
    </div>
    <canvas
      ref={canvasRef}
      className={'w-full h-full'}
    ></canvas>
  </div>;
};