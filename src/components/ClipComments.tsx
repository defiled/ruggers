import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { add, list, whenLabel, type Comment, type Mode } from '../analysis/commentStore';
import { loadNickname } from '../analysis/nickname';

/** One clip's thread. No accounts: the session nickname is the whole identity. */
export function ClipComments({ clipId }: { clipId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [nickname, setNickname] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    loadNickname().then((n) => {
      if (alive.current) setNickname(n);
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    list(clipId).then(({ comments: rows, mode: m }) => {
      if (!alive.current) return;
      setComments(rows);
      setMode(m);
    });
    return () => {
      alive.current = false;
    };
  }, [clipId]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body || sending) return;
      setSending(true);
      const { comment, mode: m } = await add(clipId, nickname, body);
      setComments((prev) => [...prev, comment]);
      setMode(m);
      setDraft('');
      setSending(false);
    },
    [clipId, draft, nickname, sending],
  );

  const count = comments.length;

  return (
    <div className="clip__comments">
      <button type="button" className="clip__commentsToggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {count === 0 ? 'Add a comment — no sign-up' : `${count} comment${count === 1 ? '' : 's'}`}
      </button>

      {open && (
        <div className="thread">
          {count > 0 && (
            <ul className="thread__list">
              {comments.map((c) => (
                <li key={c.id} className="note">
                  <div className="note__head">
                    <span className="note__who">{c.nickname}</span>
                    <span className="note__when">{whenLabel(c.createdAt)}</span>
                  </div>
                  <p className="note__body">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <form className="composer" onSubmit={submit}>
            <div className="composer__who">
              <span>
                No sign-up — you post as <strong>{nickname || '…'}</strong>
              </span>
            </div>
            <textarea
              className="field__input field__textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="What do you see here?"
              aria-label="Your comment"
            />
            <div className="composer__actions">
              <button type="submit" className="btn" disabled={!draft.trim() || sending || !nickname}>
                {sending ? 'Posting…' : 'Post'}
              </button>
              {mode === 'local' && <span className="composer__note">Saved on this device only</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
