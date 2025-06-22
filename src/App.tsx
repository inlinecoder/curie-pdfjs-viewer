import { useCallback, useState } from 'react';

import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
} from '@/components/ui/card.tsx';

import { Progress } from '@/components/ui/progress.tsx';

import { PdfViewer } from '@/components/pdfViewer.tsx';

import { PDF_DEMO_ASSETS } from '@/consts.ts';

import './App.css';

function App() {
  const [selectedPdfDemoAsset, setSelectedPdfDemoAsset] = useState(PDF_DEMO_ASSETS[0]);
  const [isOcrInProgress, setIsOcrInProgress] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const handleOcrInProgressChange = useCallback((inProgress: boolean) => {
    setIsOcrInProgress(inProgress);
  }, []);
  const handleOcrProgress = useCallback((completionPercentage: number) => {
    setOcrProgress(completionPercentage);
  }, []);

  return (
    <div className={'flex flex-col min-h-screen min-w-screen bg-gray-100'}>
      <div className={'flex p-2 gap-2 overflow-y-visible overflow-x-scroll'}>
        {PDF_DEMO_ASSETS.map((pdfDemoAsset) => (
          <Card
            key={pdfDemoAsset.url}
            className={cn(
            'relative flex shrink-0 cursor-pointer hover:bg-primary/5',
              pdfDemoAsset.url !== selectedPdfDemoAsset.url && 'bg-transparent shadow-none',
            )}
            onClick={() => { setSelectedPdfDemoAsset(pdfDemoAsset); }}
          >
            <div className={'flex gap-2 absolute inset-2'}>
              {isOcrInProgress
                && pdfDemoAsset.url === selectedPdfDemoAsset.url
                && <Progress value={ocrProgress}></Progress>
              }
            </div>
            <CardContent>
              <span
                className={cn(
                  'font-bold',
                  pdfDemoAsset.url !== selectedPdfDemoAsset.url && 'opacity-60',
                )}
              >{pdfDemoAsset.title}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={'flex p-2'}>
        <Card className={'flex-1'}>
          <CardContent className={'flex flex-col gap-2 w-full'}>
            <PdfViewer
              url={selectedPdfDemoAsset.url}
              onIsOcrInProgressChange={handleOcrInProgressChange}
              onOrcProgress={handleOcrProgress}
            />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

export default App;
