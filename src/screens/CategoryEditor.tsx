import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { DEFAULT_CATEGORY_ICON, searchCategoryIcons } from '../lib/categoryIcons';
import { BUCKET_LABEL } from '../lib/categories';
import type { Bucket, Category } from '../lib/types';

const BUCKETS: Bucket[] = ['need', 'want', 'save'];
const IN_USE_MESSAGE = 'Choose a category to move them to';

/**
 * Add or edit a category: name, bucket, icon. Editing also moves the category up or down and deletes it.
 * Deleting a category that has entries asks for another category to move them to first.
 */
export function CategoryEditor({
  token,
  category,
  others,
  onClose,
  onSaved,
}: {
  token: string;
  category: Category | null;
  others: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = category !== null;
  const [name, setName] = useState(category?.name ?? '');
  const [bucket, setBucket] = useState<Bucket>(category?.bucket ?? 'want');
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [needsMove, setNeedsMove] = useState(false);

  const icons = searchCategoryIcons(query);

  function fail(e: unknown) {
    haptic('error');
    setErr(e instanceof Error ? e.message : 'Could not save');
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), bucket, icon, ...(editing ? { id: category.id } : {}) };
      await api('categories', { token, method: editing ? 'PATCH' : 'POST', body });
      haptic('success');
      onSaved(editing ? `Updated ${name.trim()}` : `Added ${name.trim()}`);
      onClose();
    } catch (e2) {
      fail(e2);
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: 'up' | 'down') {
    if (!category) return;
    setBusy(true);
    try {
      await api('categories', { token, method: 'PATCH', body: { id: category.id, move: direction } });
      haptic('tap');
      onSaved(`Moved ${category.name} ${direction}`);
      onClose();
    } catch (e2) {
      fail(e2);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!category) return;
    if (!needsMove && !window.confirm(`Delete "${category.name}"?`)) return;
    setErr(null);
    setBusy(true);
    try {
      const reassign = moveTo ? `&reassignTo=${encodeURIComponent(moveTo)}` : '';
      await api(`categories?id=${encodeURIComponent(category.id)}${reassign}`, { token, method: 'DELETE' });
      haptic('success');
      onSaved(`Deleted ${category.name}`);
      onClose();
    } catch (e2) {
      const message = e2 instanceof Error ? e2.message : '';
      if (message.includes(IN_USE_MESSAGE)) {
        // Entries use it: ask where they should go, then try again.
        setNeedsMove(true);
        setErr(message);
      } else {
        fail(e2);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="abs inset-0 flex" role="dialog" aria-modal="true" aria-label={editing ? 'Edit category' : 'Add category'} style={{ zIndex: 30, flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }} />
      <form onSubmit={save} className="pop rel grid gap-10" style={{ background: 'var(--color-surface)', borderRadius: '18px 18px 0 0', padding: '18px 18px 26px', borderTop: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="kicker">{editing ? 'Edit category' : 'New category'}</div>

        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} required maxLength={40} placeholder="e.g. Fuel" />
        </Field>

        <fieldset className="fieldset-reset grid gap-6">
          <legend className="kicker kicker--spaced">Bucket</legend>
          <div className="chiprow" style={{ margin: 0, padding: 0 }}>
            {BUCKETS.map(b => (
              <button type="button" key={b} aria-pressed={bucket === b} className={`chip ${bucket === b ? 'chip--on' : ''}`} onClick={() => setBucket(b)}>{BUCKET_LABEL[b]}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="fieldset-reset grid gap-6">
          <legend className="kicker kicker--spaced">Icon</legend>
          <Field label="Search icons">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. fuel, medical, travel" maxLength={40} />
          </Field>
          <div className="icon-grid mt-8" role="group" aria-label="Icons">
            {icons.map(c => (
              <button
                type="button"
                key={c.name}
                aria-label={c.label}
                aria-pressed={icon === c.name}
                title={c.label}
                className={`icon-choice tone--${bucket}`}
                onClick={() => setIcon(c.name)}
              >
                <Icon name={c.name} size={20} />
              </button>
            ))}
          </div>
          {icons.length === 0 && <p className="fs-13 c-sec" style={{ margin: 0 }}>No icon matches “{query}”.</p>}
        </fieldset>

        {err && <p className="c-danger fs-13" role="alert" style={{ margin: 0 }}>{err}</p>}

        {needsMove && (
          <fieldset className="fieldset-reset grid gap-6">
            <legend className="kicker kicker--spaced">Move its entries to</legend>
            <div className="chiprow" style={{ margin: 0, padding: 0 }}>
              {others.map(o => (
                <button type="button" key={o.id} aria-pressed={moveTo === o.id} className={`chip ${moveTo === o.id ? 'chip--on' : ''}`} onClick={() => setMoveTo(o.id)}>{o.name}</button>
              ))}
            </div>
          </fieldset>
        )}

        <Button type="submit" disabled={busy || (needsMove && !moveTo)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add category'}</Button>

        {editing && (
          <div className="flex gap-8 jc-sb mt-4">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => move('up')} aria-label={`Move ${category.name} up`}>
              <Icon name="chevron-up" size={15} /> Up
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => move('down')} aria-label={`Move ${category.name} down`}>
              <Icon name="chevron-down" size={15} /> Down
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={busy || (needsMove && !moveTo)} onClick={remove}>
              {needsMove ? 'Delete and move' : 'Delete'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
