import { useEffect } from 'react';
import { Scene } from './render/Scene';
import { controller } from './state/controller';
import { ConsideringPanel, Dialogue, EvaluationPanel, EvidenceCard, IntroCard, StatusChip, TeachingCard, TopBar } from './ui/Panels';

export function App() {
  useEffect(() => {
    controller.init();
  }, []);
  return (
    <div className="app">
      <div className="stage">
        <Scene />
      </div>
      <TopBar />
      <IntroCard />
      <StatusChip />
      <Dialogue />
      <TeachingCard />
      <EvidenceCard />
      <ConsideringPanel />
      <EvaluationPanel />
    </div>
  );
}
