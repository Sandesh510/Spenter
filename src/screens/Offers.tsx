import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select, TextArea } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { isCreditCard } from '../lib/accountTypes';
import { CARD_CATALOG, CATALOG_AS_OF, findCatalogCard, offersForCard } from '../lib/cardCatalog';
import { currentMonth } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR, paiseToPlain, parseRupeesToPaise } from '../lib/money';
import { IMPORT_EXAMPLE, OFFER_KIND_LABEL, parseOfferImport, type CapPeriod, type CardOffer, type NewOffer, type OfferKind } from '../lib/offers';
import { useApi } from '../lib/useApi';
import type { Account, HomeData } from '../lib/types';
import type { Route } from '../App';

const PERIOD_LABEL: Record<CapPeriod, string> = { month: 'a month', cycle: 'a statement cycle', quarter: 'a quarter' };

/** "5% back on Amazon, up to ₹2,000 a month". */
function describe(o: CardOffer, categoryName: string | null): string {
  const what = o.kind === 'cashback_pct' ? `${o.rate}% back` : o.kind === 'points_per_100' ? `${o.rate} points per ₹100` : `${formatINR(Math.round(o.rate * 100))} off`;
  const where = o.merchant ? `on ${o.merchant}` : categoryName ? `on ${categoryName}` : 'on everything else';
  const cap = o.cap_paise ? `, up to ${formatINR(o.cap_paise)} ${PERIOD_LABEL[o.cap_period ?? 'month']}` : '';
  const min = o.min_spend_paise ? `, from ${formatINR(o.min_spend_paise)}` : '';
  return `${what} ${where}${cap}${min}`;
}

/**
 * Card offers: what each credit card gives back, used to suggest which card to use in "Should I buy this?".
 * Offers come from the popular cards list or are typed in, and every one can be edited. Nothing here
 * changes a balance.
 */
export function Offers({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const offers = useApi<{ items: CardOffer[] }>('offers', token);
  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const [editing, setEditing] = useState<{ cardId: string; offer: CardOffer | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = (accounts.data?.items ?? []).filter(a => isCreditCard(a.kind));
  const categories = home.data?.categories ?? [];
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? null;
  const all = offers.data?.items ?? [];

  async function loadStandard(card: Account) {
    const match = findCatalogCard(card.nickname);
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const { offers: list, skipped } = offersForCard(match, card.id, categories);
      const res = await api<{ added: number; skipped: number }>('offers', { token, body: { items: list } });
      haptic('success');
      offers.reload();
      onToast(res.added > 0 ? `${res.added} offers added to ${card.nickname}${skipped.length ? `, ${skipped.length} need a category you do not have` : ''}` : 'Nothing new to add');
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not load offers');
    } finally {
      setBusy(false);
    }
  }

  async function remove(o: CardOffer) {
    setError(null);
    try {
      await api(`offers?id=${o.id}`, { method: 'DELETE', token });
      offers.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove');
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('settings')} aria-label="Back to Settings"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Card offers</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      <p className="fs-13 c-sec m-0 mt-8">
        What each card gives back. &ldquo;Should I buy this?&rdquo; uses these to suggest the best card for a purchase. Edit anything that is not right for you.
      </p>
      {error && <p className="c-danger fs-13 mt-12" role="alert">{error}</p>}

      {accounts.data && cards.length === 0 && (
        <Card as="section" className="mt-16">
          <p className="fs-14 m-0">No credit card yet.</p>
          <p className="fs-12 c-sec m-0 mt-4">Add a card in Settings, Accounts, with the type Credit card. You can pick it from the popular cards list to bring its offers.</p>
        </Card>
      )}

      <ul className="list-reset grid gap-14 mt-16">
        {cards.map(card => {
          const mine = all.filter(o => o.account_id === card.id);
          const match = findCatalogCard(card.nickname);
          return (
            <li key={card.id}>
              <Card as="section" aria-label={card.nickname}>
                <div className="flex ai-base jc-sb gap-8">
                  <h2 className="fs-15 m-0">{card.nickname}</h2>
                  <span className="fs-12 c-sec">{mine.length} {mine.length === 1 ? 'offer' : 'offers'}</span>
                </div>
                {match && (
                  <div className="mt-8">
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => loadStandard(card)}>
                      {mine.length === 0 ? 'Load standard offers' : 'Add any missing standard offers'}
                    </Button>
                    <p className="fs-11 c-mut m-0 mt-4">
                      {match.name}, as of {CATALOG_AS_OF}. <a className="c-accent" href={match.source} target="_blank" rel="noreferrer noopener">Source</a>. Check with your bank.
                    </p>
                  </div>
                )}
                {mine.length > 0 && (
                  <ul className="list-reset grid gap-8 mt-12">
                    {mine.map(o => (
                      <li key={o.id} className="flex ai-c jc-sb gap-8 offer-row">
                        <button className="offer-row__main" onClick={() => setEditing({ cardId: card.id, offer: o })} aria-label={`Edit ${o.title}`}>
                          <span className="fs-13 d-block">{o.title}</span>
                          <span className="fs-12 c-sec d-block">{describe(o, categoryName(o.category_id))}</span>
                          {o.note && <span className="fs-11 c-mut d-block">{o.note}</span>}
                        </button>
                        <button className="iconbtn iconbtn--sm" onClick={() => remove(o)} aria-label={`Remove ${o.title}`}><Icon name="trash-2" size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="link mt-8" onClick={() => setEditing({ cardId: card.id, offer: null })}>+ Add an offer</button>
              </Card>
            </li>
          );
        })}
      </ul>

      {cards.length > 0 && <PasteOffers token={token} cards={cards} categories={categories} onAdded={n => { offers.reload(); onToast(`${n} offers added`); }} />}

      <p className="fs-11 c-mut m-0 mt-16">
        Cards with a ready list: {CARD_CATALOG.map(c => c.name.replace(' Credit Card', '')).join(', ')}.
      </p>

      {editing && (
        <OfferForm
          key={editing.offer?.id ?? 'new'}
          token={token}
          cardId={editing.cardId}
          offer={editing.offer}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            offers.reload();
          }}
        />
      )}
    </div>
  );
}

/** Add or edit one offer in a bottom sheet. */
function OfferForm({ token, cardId, offer, categories, onClose, onSaved }: {
  token: string;
  cardId: string;
  offer: CardOffer | null;
  categories: HomeData['categories'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(offer?.title ?? '');
  const [kind, setKind] = useState<OfferKind>(offer?.kind ?? 'cashback_pct');
  const [rate, setRate] = useState(offer ? String(offer.rate) : '');
  const [pointValue, setPointValue] = useState(offer?.point_value_paise ? String(offer.point_value_paise / 100) : '');
  const [merchant, setMerchant] = useState(offer?.merchant ?? '');
  const [categoryId, setCategoryId] = useState(offer?.category_id ?? '');
  const [excluded, setExcluded] = useState<string[]>(offer?.exclude_category_ids ?? []);
  const [cap, setCap] = useState(offer?.cap_paise ? paiseToPlain(offer.cap_paise).replace(/\.00$/, '') : '');
  const [capPeriod, setCapPeriod] = useState<CapPeriod>(offer?.cap_period ?? 'month');
  const [minSpend, setMinSpend] = useState(offer?.min_spend_paise ? paiseToPlain(offer.min_spend_paise).replace(/\.00$/, '') : '');
  const [validTo, setValidTo] = useState(offer?.valid_to ?? '');
  const [note, setNote] = useState(offer?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const rateNum = Number(rate);
    if (!title.trim()) return setError('Give the offer a name');
    if (!Number.isFinite(rateNum) || rateNum <= 0) return setError('Enter the rate as a number above zero');
    let pointPaise: number | null = null;
    let capPaise: number | null = null;
    let minPaise: number | null = null;
    try {
      if (kind === 'points_per_100') {
        const pv = Number(pointValue);
        if (!Number.isFinite(pv) || pv <= 0) return setError('Enter what one point is worth in rupees, such as 0.25');
        pointPaise = Math.max(1, Math.round(pv * 100));
      }
      if (cap.trim()) capPaise = parseRupeesToPaise(cap.trim());
      if (minSpend.trim()) minPaise = parseRupeesToPaise(minSpend.trim());
    } catch {
      return setError('Enter amounts in rupees, such as 2000');
    }

    const body: Record<string, unknown> = {
      account_id: cardId,
      title: title.trim(),
      kind,
      rate: rateNum,
      point_value_paise: pointPaise,
      merchant: merchant.trim() || null,
      category_id: categoryId || null,
      exclude_category_ids: excluded,
      cap_paise: capPaise,
      cap_period: capPaise ? capPeriod : null,
      min_spend_paise: minPaise,
      valid_to: validTo || null,
      note: note.trim() || null,
    };
    setBusy(true);
    try {
      if (offer) await api('offers', { method: 'PATCH', token, body: { id: offer.id, ...body } });
      else await api('offers', { token, body });
      haptic('success');
      onSaved();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label={offer ? 'Edit offer' : 'Add an offer'} onClose={onClose}>
      <form className="grid gap-12" onSubmit={save}>
        <h2 className="fs-18 m-0">{offer ? 'Edit offer' : 'Add an offer'}</h2>
        <Field label="Name">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 5% back on Amazon" maxLength={80} required />
        </Field>

        <fieldset className="chipset">
          <legend className="kicker">It gives</legend>
          <div className="flex flex-wrap gap-8">
            {(Object.keys(OFFER_KIND_LABEL) as OfferKind[]).map(k => (
              <button key={k} type="button" className={`chip ${kind === k ? 'chip--on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{OFFER_KIND_LABEL[k]}</button>
            ))}
          </div>
        </fieldset>

        <div className="grid-2 gap-12">
          <Field label={kind === 'cashback_pct' ? 'Percent back' : kind === 'points_per_100' ? 'Points per ₹100' : 'Rupees off'}>
            <Input numeric inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="5" required />
          </Field>
          {kind === 'points_per_100' && (
            <Field label="One point is worth (₹)">
              <Input numeric inputMode="decimal" value={pointValue} onChange={e => setPointValue(e.target.value)} placeholder="0.25" />
            </Field>
          )}
        </div>

        <Field label="On this category (optional)" hint="Leave on Any to apply to everything.">
          <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Any category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="At this merchant (optional)" hint="A word from the item name, such as Amazon or Swiggy.">
          <Input value={merchant} onChange={e => setMerchant(e.target.value)} maxLength={40} />
        </Field>

        <div className="grid-2 gap-12">
          <Field label="Most it gives (₹, optional)">
            <Input numeric inputMode="decimal" value={cap} onChange={e => setCap(e.target.value)} placeholder="2000" />
          </Field>
          <Field label="Smallest purchase (₹)">
            <Input numeric inputMode="decimal" value={minSpend} onChange={e => setMinSpend(e.target.value)} placeholder="0" />
          </Field>
        </div>
        {cap.trim() && (
          <fieldset className="chipset">
            <legend className="kicker">The most is counted per</legend>
            <div className="flex flex-wrap gap-8">
              {(Object.keys(PERIOD_LABEL) as CapPeriod[]).map(p => (
                <button key={p} type="button" className={`chip ${capPeriod === p ? 'chip--on' : ''}`} aria-pressed={capPeriod === p} onClick={() => setCapPeriod(p)}>{PERIOD_LABEL[p].replace('a ', '')}</button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="chipset">
          <legend className="kicker">Not on these categories</legend>
          <div className="flex flex-wrap gap-8">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={`chip ${excluded.includes(c.id) ? 'chip--on' : ''}`}
                aria-pressed={excluded.includes(c.id)}
                onClick={() => setExcluded(list => (list.includes(c.id) ? list.filter(x => x !== c.id) : [...list, c.id]))}
              >
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Valid until (optional)">
          <Input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
        </Field>

        {error && <p className="c-danger fs-13 m-0" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : offer ? 'Save changes' : 'Add offer'}</Button>
      </form>
    </Sheet>
  );
}

/** A list of offers pasted as JSON (see the example), checked against the user's cards before it is saved. */
function PasteOffers({ token, cards, categories, onAdded }: {
  token: string;
  cards: Account[];
  categories: HomeData['categories'];
  onAdded: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ offers: NewOffer[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button className="link link--block mt-16" onClick={() => setOpen(true)}>Paste a list of offers →</button>;
  }

  async function add() {
    if (!result || result.offers.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ added: number }>('offers', { token, body: { items: result.offers } });
      haptic('success');
      setText('');
      setResult(null);
      setOpen(false);
      onAdded(res.added);
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="mt-16" aria-label="Paste offers">
      <h2 className="kicker kicker--spaced m-0">Paste a list of offers</h2>
      <p className="fs-12 c-sec m-0 mt-4">One object per offer. Card names are matched to your cards, category names to your categories.</p>
      <div className="mt-8">
        <TextArea value={text} onChange={e => { setText(e.target.value); setResult(null); }} placeholder={IMPORT_EXAMPLE} spellCheck={false} aria-label="Offers as JSON" />
      </div>
      <div className="flex gap-8 mt-8">
        <Button variant="secondary" block disabled={!text.trim()} onClick={() => setResult(parseOfferImport(text, cards, categories))}>Check</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
      {result && (
        <div className="mt-12">
          {result.errors.length > 0 && (
            <ul className="list-reset grid gap-4 fs-12 c-danger" role="alert">
              {result.errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          )}
          {result.offers.length > 0 && (
            <>
              <p className="fs-13 m-0 mt-8">{result.offers.length} {result.offers.length === 1 ? 'offer' : 'offers'} ready to add.</p>
              {error && <p className="c-danger fs-13 m-0 mt-4" role="alert">{error}</p>}
              <Button block className="mt-8" disabled={busy} onClick={add}>{busy ? 'Adding…' : `Add ${result.offers.length}`}</Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
