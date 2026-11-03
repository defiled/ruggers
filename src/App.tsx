import { useState } from 'react';
import { AnalysisTab } from './components/AnalysisTab';
import { DefenceTab } from './components/DefenceTab';
import { FeedbackWidget } from './components/FeedbackWidget';
import { FormationsTab } from './components/FormationsTab';
import { Gate } from './components/Gate';
import { IconFilm, IconGrid, IconPlay, IconShield } from './components/icons';
import { PlaysTab } from './components/PlaysTab';

type Tab = 'formations' | 'plays' | 'defence' | 'analysis';

/**
 * The playbook tabs are hidden while they are being refined, so the site opens on
 * match analysis and nothing else is reachable. Set this back to true to restore
 * Formations / Plays / Defence; nothing else has to change.
 */
export const PLAYBOOK_ENABLED = false;

const ALL_TABS: Array<{ id: Tab; label: string; Icon: typeof IconGrid }> = [
  { id: 'formations', label: 'Formations', Icon: IconGrid },
  { id: 'plays', label: 'Plays', Icon: IconPlay },
  { id: 'defence', label: 'Defence', Icon: IconShield },
  { id: 'analysis', label: 'Analysis', Icon: IconFilm },
];

const TABS = PLAYBOOK_ENABLED ? ALL_TABS : ALL_TABS.filter((t) => t.id === 'analysis');

export default function App() {
  return (
    <Gate>
      <Shell />
    </Gate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>(PLAYBOOK_ENABLED ? 'plays' : 'analysis');
  return (
    <div className={`app${TABS.length > 1 ? '' : ' app--solo'}`}>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__brand">
            <img className="masthead__crest" src="/logo.webp" alt="" width="28" height="28" />
            <span className="masthead__club">Frederick Rugby</span>
            <h1 className="masthead__title">{PLAYBOOK_ENABLED ? 'Playbook' : 'Analysis'}</h1>
          </div>
          {/* One nav: inline in the masthead on wide screens, a fixed bottom bar on phones.
              With a single section there is nothing to switch between, so it is dropped. */}
          {TABS.length > 1 && (
          <nav className="tabs" aria-label="Sections">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} type="button" className={`tab${tab === id ? ' is-active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                <Icon className="tab__icon" size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          )}
        </div>
      </header>
      <main className="shell">
        {tab === 'formations' ? <FormationsTab /> : tab === 'plays' ? <PlaysTab /> : tab === 'defence' ? <DefenceTab /> : <AnalysisTab />}
      </main>
      {PLAYBOOK_ENABLED && (
        <footer className="foot">
          Starting formations are copied from the Rugby Tactics Board presets (rugbytacticsboard.com). Plays follow their common coached versions; defenders run scripted responses, not real-time AI.
        </footer>
      )}
      <FeedbackWidget />
    </div>
  );
}
