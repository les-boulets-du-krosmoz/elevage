import { useState } from 'react';
import { CouplesPage } from './components/CouplesPage';
import { DataPage } from './components/DataPage';
import { EnclosPage } from './components/EnclosPage';
import { Header } from './components/Header';
import { HistoryPage } from './components/HistoryPage';
import { ColorDatalist } from './components/ui';
import { EtableProvider } from './store/EtableContext';
import { ToastProvider } from './store/ToastContext';
import { useOtherTab } from './store/useOtherTab';

const TABS = [
  { id: 'enclos', label: 'Mon enclos', Page: EnclosPage },
  { id: 'couples', label: 'Couples', Page: CouplesPage },
  { id: 'historique', label: 'Historique', Page: HistoryPage },
  { id: 'donnees', label: 'Données', Page: DataPage },
] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('enclos');
  const otherTab = useOtherTab();
  const { Page } = TABS.find((t) => t.id === tab)!;
  return (
    <ToastProvider>
      <EtableProvider>
        <div className="wrap">
          <Header />
          {otherTab && (
            <div className="tabwarn" role="alert">
              ⚠ Le site est aussi ouvert dans un autre onglet. Ferme l'un des deux : sinon, les modifications de l'un peuvent écraser celles de l'autre.
            </div>
          )}
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
          <Page />
        </div>
        <ColorDatalist />
      </EtableProvider>
    </ToastProvider>
  );
}
