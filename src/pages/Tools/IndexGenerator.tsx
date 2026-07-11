import { useEffect, useRef, useState } from 'react';
import { documentApi, trackTool, type IndexPayload, type IndexRow } from '../../services/documentApi';
import Dropzone from '../ErrorReport/Dropzone';
import FileList from '../ErrorReport/FileList';
import ProcessingPanel from '../../components/ProcessingPanel';
import ResultPreview from '../../components/ResultPreview';
import { useChainedIntake } from '../../services/toolChain';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';
import '../../styles/IndexGenerator.css';

/** One editable index-table row. */
interface Row extends IndexRow {
  id: number;
}

/** One party block inside a "matter of" section. `lines` is edited as a
 * multiline string (one party line per row) and split on submit. */
interface Party {
  id: number;
  text: string;
  role: string;
}

interface Matter {
  id: number;
  label: string;
  parties: Party[];
}

const splitLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export default function IndexGeneratorTool() {
  const doc = useFileList();
  const [phase, setPhase] = useState<'edit' | 'seeding' | 'generating' | 'done' | 'error'>('edit');
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const nextId = useRef(0);
  const id = () => nextId.current++;

  // ── Case details ──
  const [court, setCourt] = useState(
    "BEFORE THE HON'BLE NATIONAL COMPANY LAW TRIBUNAL,\nNEW DELHI"
  );
  const [caseLines, setCaseLines] = useState('IA NO. _________ OF 2026');
  const [matters, setMatters] = useState<Matter[]>([
    {
      id: id(),
      label: 'IN THE MATTER OF:',
      parties: [
        { id: id(), text: '', role: 'Applicant' },
        { id: id(), text: '', role: 'Respondents' },
      ],
    },
  ]);
  const [indexTitle, setIndexTitle] = useState('MASTER INDEX');
  const [rows, setRows] = useState<Row[]>([
    { id: id(), title: 'MEMO OF PARTIES', description: '', pages: '' },
  ]);
  const [advocates, setAdvocates] = useState('');
  const [place, setPlace] = useState('NEW DELHI');
  const [date, setDate] = useState('');
  const [prepend, setPrepend] = useState(true);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  const chainedFrom = useChainedIntake(doc.add);

  // ── Matters editing ──
  const patchMatter = (mid: number, patch: Partial<Matter>) =>
    setMatters((ms) => ms.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
  const patchParty = (mid: number, pid: number, patch: Partial<Party>) =>
    setMatters((ms) =>
      ms.map((m) =>
        m.id === mid
          ? { ...m, parties: m.parties.map((p) => (p.id === pid ? { ...p, ...patch } : p)) }
          : m
      )
    );
  const addMatter = () =>
    setMatters((ms) => [
      ...ms,
      {
        id: id(),
        label: 'AND IN THE MATTER OF:',
        parties: [
          { id: id(), text: '', role: 'Applicant' },
          { id: id(), text: '', role: 'Respondents' },
        ],
      },
    ]);
  const removeMatter = (mid: number) => setMatters((ms) => ms.filter((m) => m.id !== mid));
  const addParty = (mid: number) =>
    setMatters((ms) =>
      ms.map((m) =>
        m.id === mid ? { ...m, parties: [...m.parties, { id: id(), text: '', role: '' }] } : m
      )
    );
  const removeParty = (mid: number, pid: number) =>
    setMatters((ms) =>
      ms.map((m) =>
        m.id === mid ? { ...m, parties: m.parties.filter((p) => p.id !== pid) } : m
      )
    );

  // ── Rows editing ──
  const patchRow = (rid: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const removeRow = (rid: number) => setRows((rs) => rs.filter((r) => r.id !== rid));
  const moveRow = (rid: number, dir: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === rid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const addRow = () =>
    setRows((rs) => [...rs, { id: id(), title: '', description: '', pages: '' }]);

  // Seed rows from the uploaded document: run bookmark detection and turn
  // top-level headings into index rows with start–end page ranges (end =
  // next heading's page - 1; the last row runs to the document end, which
  // we don't know here, so it gets just the start page).
  const seedFromDocument = async () => {
    if (doc.files.length === 0) return;
    setErrorMsg('');
    setPhase('seeding');
    try {
      const result = await documentApi.detectBookmarks(doc.files);
      if (!result.ok) throw new Error(result.error || 'Detection failed');
      const tops = result.headings.filter((h) => h.level === 1 && h.confidence >= 0.6);
      if (tops.length === 0) {
        setErrorMsg('No confident top-level headings found — add rows manually.');
        setPhase('edit');
        return;
      }
      const seeded: Row[] = tops.map((h, i) => {
        const start = h.page;
        const next = tops[i + 1]?.page;
        const end = next && next - 1 > start ? next - 1 : undefined;
        return {
          id: id(),
          title: h.title,
          description: '',
          pages: end ? `${start}-${end}` : String(start),
        };
      });
      setRows(seeded);
      setPhase('edit');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read document');
      setPhase('edit');
    }
  };

  const validRows = rows.filter((r) => r.title.trim());
  const canGenerate = validRows.length > 0 && phase === 'edit';

  const generate = async () => {
    if (!canGenerate) return;
    setErrorMsg('');
    setPhase('generating');
    try {
      const payload: IndexPayload = {
        court: splitLines(court),
        caseLines: splitLines(caseLines),
        matters: matters
          .map((m) => ({
            label: m.label.trim(),
            parties: m.parties
              .map((p) => ({ lines: splitLines(p.text), role: p.role.trim() }))
              .filter((p) => p.lines.length > 0),
          }))
          .filter((m) => m.parties.length > 0),
        indexTitle: indexTitle.trim() || 'INDEX',
        rows: validRows.map(({ title, description, pages }) => ({
          title: title.trim(),
          description: (description || '').trim(),
          pages: pages.trim(),
        })),
        advocates: splitLines(advocates),
        place: place.trim(),
        date: date.trim(),
      };
      const { blob, filename } = await documentApi.generateIndex(
        payload,
        prepend ? doc.files : []
      );
      setResult({ blob, filename });
      trackTool('index-generator');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate index');
      setPhase('error');
    }
  };

  const busy = phase === 'seeding' || phase === 'generating';

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Index Generator</h1>
          <p className="er__subtitle">
            Fill in the case details, list the contents, and download a court-ready Master
            Index — standalone or stitched to the front of your paginated filing.
          </p>
        </header>

        {phase === 'done' && result && (
          <ResultPreview
            blob={result.blob}
            filename={result.filename}
            message="✓ Index PDF ready."
            onReset={() => {
              setResult(null);
              setPhase('edit');
            }}
            resetLabel="Back to Editor"
            producedBy="Index Generator"
            nextSteps={[
              { label: 'Add Bookmarks', to: '/tools/bookmarks' },
              { label: 'Stamp Signatures', to: '/tools/signatures' },
            ]}
          />
        )}

        {phase === 'error' && (
          <section className="er__upload-section">
            <div className="er__error-msg">
              <p>{errorMsg}</p>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setPhase('edit')}>
                Try Again
              </button>
            </div>
          </section>
        )}

        {busy && (
          <ProcessingPanel
            label={phase === 'seeding' ? 'Reading document structure' : 'Generating the index'}
          />
        )}

        {phase === 'edit' && (
          <>
            {errorMsg && <p className="ix__hint ix__hint--warn">{errorMsg}</p>}

            {/* ── Document (optional) ── */}
            <section className="er__upload-section">
              <h2 className="er__section-heading">Document (optional)</h2>
              {chainedFrom && (
                <p className="rp__chip">✓ Document carried over from {chainedFrom} — ready to go.</p>
              )}
              <p className="ix__hint">
                Upload the paginated filing to auto-fill rows from its structure and to attach
                the index in front of it. Number the pages first with the Page Numbering tool
                if it isn't paginated yet.
              </p>
              <Dropzone
                inputId="ix-doc-upload"
                inputRef={doc.inputRef}
                hasFiles={doc.files.length > 0}
                mainText={doc.files.length ? 'Add another volume' : 'Drop your PDF here or click to browse'}
                hintText={doc.files.length ? 'Files are merged in order' : 'Optional — index can also be generated alone'}
                onAdd={doc.add}
              />
              {doc.files.length > 0 && (
                <>
                  <FileList
                    files={doc.files}
                    rowLabel={(i) => `Vol ${i + 1}`}
                    onMove={doc.move}
                    onRemove={doc.remove}
                    disabled={false}
                  />
                  <div className="ix__doc-actions">
                    <button type="button" className="er__btn er__btn--outline" onClick={seedFromDocument}>
                      Auto-fill Rows from Document
                    </button>
                    <label className="ix__check">
                      <input
                        type="checkbox"
                        checked={prepend}
                        onChange={(e) => setPrepend(e.target.checked)}
                      />
                      Attach index to the front of the document
                    </label>
                  </div>
                </>
              )}
            </section>

            {/* ── Court & case ── */}
            <section className="er__upload-section">
              <h2 className="er__section-heading">Court &amp; Case</h2>
              <div className="ix__grid">
                <label className="ix__field">
                  <span>Court (one line per row)</span>
                  <textarea
                    rows={2}
                    value={court}
                    onChange={(e) => setCourt(e.target.value)}
                    placeholder={"BEFORE THE HON'BLE …,\nNEW DELHI"}
                  />
                </label>
                <label className="ix__field">
                  <span>Case numbers (one line per row)</span>
                  <textarea
                    rows={3}
                    value={caseLines}
                    onChange={(e) => setCaseLines(e.target.value)}
                    placeholder={'IA NO. ___ OF 2026\nIN\nCP (IB) NO. …'}
                  />
                </label>
              </div>
            </section>

            {/* ── Parties ── */}
            <section className="er__upload-section">
              <h2 className="er__section-heading">Parties</h2>
              {matters.map((m) => (
                <div key={m.id} className="ix__matter">
                  <div className="ix__matter-head">
                    <input
                      type="text"
                      className="ix__matter-label"
                      value={m.label}
                      onChange={(e) => patchMatter(m.id, { label: e.target.value })}
                      placeholder="IN THE MATTER OF:"
                    />
                    {matters.length > 1 && (
                      <button
                        type="button"
                        className="ix__icon-btn"
                        onClick={() => removeMatter(m.id)}
                        aria-label="Remove section"
                      >
                        ✗
                      </button>
                    )}
                  </div>
                  {m.parties.map((p, pi) => (
                    <div key={p.id} className="ix__party">
                      {pi > 0 && <div className="ix__versus">Versus</div>}
                      <div className="ix__party-fields">
                        <textarea
                          rows={2}
                          value={p.text}
                          onChange={(e) => patchParty(m.id, p.id, { text: e.target.value })}
                          placeholder={'Party name\nDesignation / address lines'}
                        />
                        <input
                          type="text"
                          value={p.role}
                          onChange={(e) => patchParty(m.id, p.id, { role: e.target.value })}
                          placeholder="Applicant / Respondents"
                        />
                        {m.parties.length > 1 && (
                          <button
                            type="button"
                            className="ix__icon-btn"
                            onClick={() => removeParty(m.id, p.id)}
                            aria-label="Remove party"
                          >
                            ✗
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="ix__mini-btn" onClick={() => addParty(m.id)}>
                    + Party
                  </button>
                </div>
              ))}
              <button type="button" className="er__btn er__btn--outline" onClick={addMatter}>
                + Add "AND IN THE MATTER OF" Section
              </button>
            </section>

            {/* ── Index rows ── */}
            <section className="er__upload-section">
              <h2 className="er__section-heading">Index Contents</h2>
              <div className="ix__grid">
                <label className="ix__field">
                  <span>Index title</span>
                  <input
                    type="text"
                    value={indexTitle}
                    onChange={(e) => setIndexTitle(e.target.value)}
                    placeholder="MASTER INDEX / VOL-I INDEX"
                  />
                </label>
              </div>
              <div className="ix__rows">
                <div className="ix__rows-head">
                  <span className="ix__col-sno">#</span>
                  <span className="ix__col-main">Particulars (bold title + optional description)</span>
                  <span className="ix__col-pages">Pages</span>
                  <span className="ix__col-act" />
                </div>
                {rows.map((r, i) => (
                  <div key={r.id} className="ix__row">
                    <span className="ix__col-sno">{i + 1}.</span>
                    <div className="ix__col-main">
                      <input
                        type="text"
                        value={r.title}
                        onChange={(e) => patchRow(r.id, { title: e.target.value })}
                        placeholder="MEMO OF PARTIES / ANNEXURE A-1:"
                      />
                      <textarea
                        rows={1}
                        value={r.description}
                        onChange={(e) => patchRow(r.id, { description: e.target.value })}
                        placeholder="Optional description (e.g. Copy of order dated …)"
                      />
                    </div>
                    <input
                      type="text"
                      className="ix__col-pages"
                      value={r.pages}
                      onChange={(e) => patchRow(r.id, { pages: e.target.value })}
                      placeholder="1-2"
                    />
                    <div className="ix__col-act">
                      <button type="button" className="ix__icon-btn" onClick={() => moveRow(r.id, -1)} aria-label="Move up">↑</button>
                      <button type="button" className="ix__icon-btn" onClick={() => moveRow(r.id, 1)} aria-label="Move down">↓</button>
                      <button type="button" className="ix__icon-btn" onClick={() => removeRow(r.id)} aria-label="Delete row">✗</button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="er__btn er__btn--outline" onClick={addRow}>
                + Add Row
              </button>
            </section>

            {/* ── Filing block ── */}
            <section className="er__upload-section">
              <h2 className="er__section-heading">Filing Details</h2>
              <div className="ix__grid">
                <label className="ix__field">
                  <span>Advocates block (one line per row, right-aligned in output)</span>
                  <textarea
                    rows={4}
                    value={advocates}
                    onChange={(e) => setAdvocates(e.target.value)}
                    placeholder={'ADV. NAME ONE, ADV. NAME TWO\nADVOCATES\nFIRM NAME\nADDRESS'}
                  />
                </label>
                <div className="ix__grid ix__grid--two">
                  <label className="ix__field">
                    <span>Place</span>
                    <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} />
                  </label>
                  <label className="ix__field">
                    <span>Date</span>
                    <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="12.06.2026" />
                  </label>
                </div>
              </div>
            </section>

            <button
              type="button"
              className="er__btn er__btn--primary"
              disabled={!canGenerate}
              onClick={generate}
            >
              Generate Index{prepend && doc.files.length > 0 ? ' + Document' : ''} &amp; Download
            </button>
          </>
        )}
      </div>
    </div>
  );
}
