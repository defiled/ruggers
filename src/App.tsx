import { useState } from 'react';
import { DefenceTab } from './components/DefenceTab';
import { FeedbackWidget } from './components/FeedbackWidget';
import { FormationsTab } from './components/FormationsTab';
import { Gate } from './components/Gate';
import { IconGrid, IconPlay, IconShield } from './components/icons';
import { PlaysTab } from './components/PlaysTab';

type Tab = 'formations' | 'plays' | 'defence';

const TABS: Array<{ id: Tab; label: string; Icon: typeof IconGrid }> = [
  { id: 'formations', label: 'Formations', Icon: IconGrid },
  { id: 'plays', label: 'Plays', Icon: IconPlay },
  { id: 'defence', label: 'Defence', Icon: IconShield },
];

export default function App() {
  return (
    <Gate>
      <Shell />
    </Gate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('plays');
  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__brand">
            <img className="masthead__crest" src="/logo.webp" alt="" width="28" height="28" />
            <span className="masthead__club">Frederick RFC</span>
            <h1 className="masthead__title">Playbook</h1>
          </div>
          {/* One nav: inline in the masthead on wide screens, a fixed bottom bar on phones. */}
          <nav className="tabs" aria-label="Sections">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} type="button" className={`tab${tab === id ? ' is-active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                <Icon className="tab__icon" size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="shell">{tab === 'formations' ? <FormationsTab /> : tab === 'plays' ? <PlaysTab /> : <DefenceTab />}</main>
      <footer className="foot">
        Starting formations are copied from the Rugby Tactics Board presets (rugbytacticsboard.com). Plays follow their common coached versions; defenders run scripted responses, not real-time AI.
      </footer>
      <FeedbackWidget />
    </div>
  );
}
