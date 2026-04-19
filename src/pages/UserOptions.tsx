import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentApi } from '../services/documentApi';
import Select from '../components/Select';
import '../styles/UserOptions.css';

interface FormState {
  assistance_type: string;
  forum: string;
  bench: string;
  filing_type: string;
  act: string;
  act_input: string;
  appeal_provision: string;
  application_type: string;
  interlocutory_type: string;
}

const ASSISTANCE_OPTIONS = [
  { label: 'Vetting of Draft', value: 'vetting_of_draft', next: 'vetting_flow' },
  { label: 'PDF For Filing', value: 'pdf_for_filing' },
  { label: 'Drafting Assistance', value: 'drafting_assistance' },
  { label: 'Courtroom Clerical Assistance', value: 'courtroom_clerical_assistance' },
];

const FORUM_OPTIONS = [
  'Supreme Court',
  'Delhi High Court',
  'NCLAT, Delhi',
  'NCDRC, Delhi',
  'NCLT',
  'DRT, Delhi',
];

const BENCH_OPTIONS = ['Delhi', 'Chennai'];

const FILING_TYPE_OPTIONS = [
  { label: 'Only Appeal', value: 'appeal', next: 'appeal_flow' },
  { label: 'Only Application', value: 'application', next: 'application_flow' },
  {
    label: 'Complete Appeal and Application',
    value: 'both',
    next: ['appeal_flow', 'application_flow'],
  },
];

const ACT_OPTIONS = [
  { label: 'Companies Act, 2013', value: 'companies_act' },
  { label: 'Competition Act, 2002', value: 'competition_act' },
  { label: 'Insolvency and Bankruptcy Code', value: 'ibc' },
  { label: 'Need Assistance', value: 'need_assistance', input_required: true },
];

const APPEAL_PROVISION_OPTIONS: Record<string, string[]> = {
  companies_act: ['Section 421', 'Section 132(5)'],
  competition_act: ['Section 53(B)'],
  ibc: ['Section 61(1)', 'Section 61(2)', 'Section 61(3)'],
};

const APPLICATION_TYPE_OPTIONS: Record<string, string[]> = {
  companies_act: [
    'Review Application',
    'Restoration Application',
    'Contempt Case',
    'Interlocutory Application',
    'Caveat',
  ],
  competition_act: [
    'Compensation Application',
    'Review Application',
    'Restoration Application',
    'Contempt Case',
    'Interlocutory Application',
    'Caveat',
  ],
  ibc: [
    'Review Application',
    'Restoration Application',
    'Contempt Case',
    'Interlocutory Application',
    'Caveat',
  ],
};

const INTERLOCUTORY_TYPE_OPTIONS = [
  'Condonation of delay in filing',
  'Condonation of delay in refiling',
  'Impleadment Application',
  'Application seeking directions',
  'Application seeking Intervention',
  'Exemption from filing Dim Annexures',
  'Exemption from filing Certified True Copy',
  'Stay Application',
  'Others',
];

export default function UserOptions() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    assistance_type: '',
    forum: '',
    bench: '',
    filing_type: '',
    act: '',
    act_input: '',
    appeal_provision: '',
    application_type: '',
    interlocutory_type: '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(
    'idle'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'filing_type') {
        if (value !== 'appeal' && value !== 'both') {
          next.appeal_provision = '';
        }
        if (value !== 'application' && value !== 'both') {
          next.application_type = '';
          next.interlocutory_type = '';
        }
      }

      if (key === 'act') {
        next.appeal_provision = '';
        next.application_type = '';
        next.interlocutory_type = '';
      }

      if (key === 'application_type') {
        next.interlocutory_type = '';
      }

      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadStatus('uploading');
    try {
      await documentApi.uploadDocument(file);
      setUploadStatus('success');
    } catch {
      setUploadStatus('error');
    }
  };

  const showVettingFlow = form.assistance_type === 'vetting_of_draft';
  const showAppealFlow =
    showVettingFlow && (form.filing_type === 'appeal' || form.filing_type === 'both');
  const showApplicationFlow =
    showVettingFlow && (form.filing_type === 'application' || form.filing_type === 'both');
  const showActInput = form.act === 'need_assistance';

  const isVettingComplete =
    form.assistance_type === 'vetting_of_draft' &&
    form.forum !== '' &&
    form.bench !== '' &&
    form.filing_type !== '' &&
    form.act !== '' &&
    (!showActInput || form.act_input !== '') &&
    (!showAppealFlow || form.appeal_provision !== '') &&
    (!showApplicationFlow || form.application_type !== '') &&
    (form.application_type !== 'Interlocutory Application' || form.interlocutory_type !== '');

  const isNonVettingComplete =
    form.assistance_type !== '' && form.assistance_type !== 'vetting_of_draft';

  const allFieldsComplete = isVettingComplete || isNonVettingComplete;

  return (
    <div className="options">
      <div className="options__container">
        <header className="options__header">
          <h1 className="options__title">Select your assistance requirements</h1>
        </header>

        <form className="options__form">
          <section className="options__section">
            <Select
              id="assistance_type"
              label="Assistance Type"
              options={ASSISTANCE_OPTIONS}
              value={form.assistance_type}
              onChange={(v) => update('assistance_type', v)}
              placeholder="Select assistance type"
            />
          </section>

          {showVettingFlow && (
            <>
              <section className="options__section">
                <h2 className="options__section-title">Vetting Flow</h2>

                <Select
                  id="forum"
                  label="Forum"
                  options={FORUM_OPTIONS}
                  value={form.forum}
                  onChange={(v) => update('forum', v)}
                  placeholder="Select forum"
                />

                <Select
                  id="bench"
                  label="Bench"
                  options={BENCH_OPTIONS}
                  value={form.bench}
                  onChange={(v) => update('bench', v)}
                  placeholder="Select bench"
                />

                <Select
                  id="filing_type"
                  label="Filing Type"
                  options={FILING_TYPE_OPTIONS}
                  value={form.filing_type}
                  onChange={(v) => update('filing_type', v)}
                  placeholder="Select filing type"
                />

                <Select
                  id="act"
                  label="Act"
                  options={ACT_OPTIONS}
                  value={form.act}
                  onChange={(v) => update('act', v)}
                  placeholder="Select applicable act"
                />

                {showActInput && (
                  <div className="options__input-wrapper">
                    <label className="options__input-label" htmlFor="act_input">
                      Additional Details
                    </label>
                    <input
                      type="text"
                      id="act_input"
                      className="options__input"
                      placeholder="Please describe your assistance needed..."
                      value={form.act_input}
                      onChange={(e) => update('act_input', e.target.value)}
                    />
                  </div>
                )}
              </section>

              {showAppealFlow && form.act && form.act !== 'need_assistance' && (
                <section className="options__section">
                  <h2 className="options__section-title">Appeal Flow</h2>

                  <Select
                    id="appeal_provision"
                    label="Appeal Provision"
                    options={APPEAL_PROVISION_OPTIONS[form.act] || []}
                    value={form.appeal_provision}
                    onChange={(v) => update('appeal_provision', v)}
                    placeholder="Select provision"
                  />
                </section>
              )}

              {showApplicationFlow && form.act && form.act !== 'need_assistance' && (
                <section className="options__section">
                  <h2 className="options__section-title">Application Flow</h2>

                  <Select
                    id="application_type"
                    label="Application Type"
                    options={APPLICATION_TYPE_OPTIONS[form.act] || []}
                    value={form.application_type}
                    onChange={(v) => update('application_type', v)}
                    placeholder="Select application type"
                  />

                  {form.application_type === 'Interlocutory Application' && (
                    <Select
                      id="interlocutory_type"
                      label="Interlocutory Type"
                      options={INTERLOCUTORY_TYPE_OPTIONS}
                      value={form.interlocutory_type}
                      onChange={(v) => update('interlocutory_type', v)}
                      placeholder="Select interlocutory type"
                    />
                  )}
                </section>
              )}
            </>
          )}

          {allFieldsComplete && (
            <section className="options__section options__section--upload">
              <h2 className="options__section-title">Upload Document</h2>
              <p className="options__upload-hint">
                All fields completed. Upload your draft for vetting.
              </p>

              <div className="options__upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="document-upload"
                  className="options__upload-input"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                />
                <label htmlFor="document-upload" className="options__upload-label">
                  <svg
                    className="options__upload-icon"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {file ? (
                    <span className="options__upload-filename">{file.name}</span>
                  ) : (
                    <span className="options__upload-text">Click to select or drag & drop</span>
                  )}
                </label>
              </div>

              {file && (
                <div className="options__actions">
                  <button
                    type="button"
                    className="options__btn options__btn--primary"
                    onClick={handleUpload}
                    disabled={uploadStatus === 'uploading'}
                  >
                    {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Document'}
                  </button>
                  <button
                    type="button"
                    className="options__btn options__btn--outline"
                    onClick={() => navigate('/detect-errors')}
                  >
                    Detect Errors
                  </button>
                </div>
              )}

              {uploadStatus === 'success' && (
                <p className="options__upload-success">Document uploaded successfully!</p>
              )}
              {uploadStatus === 'error' && (
                <p className="options__upload-error">
                  Failed to upload document. Please try again.
                </p>
              )}
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
