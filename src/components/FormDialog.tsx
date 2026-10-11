import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'password';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
}

interface Props {
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel: string;
  // 'danger' colours the submit button for reports and rejections.
  tone?: 'primary' | 'danger';
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
}

const control =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-500 focus:bg-white transition-all';

export const FormDialog: React.FC<Props> = ({ title, description, fields, submitLabel, tone = 'primary', onSubmit, onClose }) => {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Latest onClose without re-running the effects: re-focusing on every parent render would steal the cursor.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      const v = values[f.name].trim();
      if (f.required && !v) return setError(`${f.label} wajib diisi.`);
      if (f.minLength && v && values[f.name].length < f.minLength) return setError(`${f.label} minimal ${f.minLength} karakter.`);
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit(Object.fromEntries(fields.map((f) => [f.name, f.type === 'password' ? values[f.name] : values[f.name].trim()])));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // Rendered into <body>: the page content sits inside animated (transformed) wrappers, which would
  // otherwise make `fixed` position relative to them and clip the backdrop.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5"
      >
        <div>
          <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>}
        </div>

        {fields.map((f, i) => (
          <label key={f.name} className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">
              {f.label}
              {f.required ? <span className="text-rose-500"> *</span> : <span className="text-slate-400"> (opsional)</span>}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                ref={i === 0 ? first : undefined}
                rows={3}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                value={values[f.name]}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                className={`${control} resize-none`}
              />
            ) : (
              <input
                ref={i === 0 ? first : undefined}
                type={f.type ?? 'text'}
                autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                value={values[f.name]}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                className={control}
              />
            )}
            {f.hint && <span className="block text-[11px] text-slate-400 mt-1">{f.hint}</span>}
          </label>
        ))}

        {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`px-4 py-2.5 text-xs font-semibold text-white rounded-xl disabled:opacity-60 cursor-pointer ${
              tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
