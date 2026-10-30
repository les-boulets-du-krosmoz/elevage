import { useState } from 'react';
import { BrisagePage } from './components/BrisagePage';
import { CouplesPage } from './components/couples/CouplesPage';
import { FamiliersPage } from './components/FamiliersPage';
import { ReglagesPage } from './components/ReglagesPage';
import { EnclosPage } from './components/enclos/EnclosPage';
import { DataPage } from './components/DataPage';
import { EtablePage } from './components/etable/EtablePage';
import { Header } from './components/Header';
import { HistoryPage } from './components/HistoryPage';
import { ColorDatalist } from './components/ui';
import { EtableProvider } from './store/EtableContext';
import { ToastProvider } from './store/ToastContext';
import { useOtherTab } from './store/useOtherTab';

const TABS = [
  { id: 'etable', label: 'Mon étable', Page: EtablePage },
  { id: 'enclos', label: 'Enclos', Page: EnclosPage },
  { id: 'couples', label: 'Couples', Page: CouplesPage },
  { id: 'brisage', label: 'Brisage', Page: BrisagePage },
  { id: 'historique', label: 'Historique', Page: HistoryPage },
  { id: 'familiers', label: 'Familiers', Page: FamiliersPage },
  { id: 'reglages', label: 'Réglages', Page: ReglagesPage },
  { id: 'donnees', label: 'Données', Page: DataPage },
] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('etable');
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
