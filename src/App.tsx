import { useState } from 'react';
import { DefenceTab } from './components/DefenceTab';
import { FeedbackWidget } from './components/FeedbackWidget';
import { FormationsTab } from './components/FormationsTab';
import { Gate } from './components/Gate';
import { PlaysTab } from './components/PlaysTab';

type Tab = 'formations' | 'plays' | 'defence';

export default function App() {
  return (
    <Gate>
      <Shell />
    </Gate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('plays');
  const nav = (cls: string) => (
    <nav className={cls} aria-label="Sections">
      <button type="button" className={`tab${tab === 'formations' ? ' is-active' : ''}`} onClick={() => setTab('formations')}>
        <span className="tab__icon" aria-hidden="true">
          ▦
        </span>
        Formations
      </button>
      <button type="button" className={`tab${tab === 'plays' ? ' is-active' : ''}`} onClick={() => setTab('plays')}>
        <span className="tab__icon" aria-hidden="true">
          ▶
        </span>
        Plays
      </button>
      <button type="button" className={`tab${tab === 'defence' ? ' is-active' : ''}`} onClick={() => setTab('defence')}>
        <span className="tab__icon" aria-hidden="true">
          ⛨
        </span>
        Defence
      </button>
    </nav>
  );
  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__inner">
          <div>
            <span className="eyebrow">Frederick Steamrollers</span>
            <h1>Attack Playbook</h1>
          </div>
          {nav('tabs tabs--top')}
        </div>
      </header>
      <main className="shell">{tab === 'formations' ? <FormationsTab /> : tab === 'plays' ? <PlaysTab /> : <DefenceTab />}</main>
      <footer className="foot">
        Starting formations are copied from the Rugby Tactics Board presets (rugbytacticsboard.com). Plays follow their common coached versions; defenders run scripted responses, not real-time AI.
      </footer>
      <FeedbackWidget />
      {nav('tabs tabs--bottom')}
    </div>
  );
}
