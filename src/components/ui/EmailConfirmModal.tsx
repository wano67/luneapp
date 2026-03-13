'use client';

import { useState } from 'react';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Mail, AlertTriangle } from 'lucide-react';

type EmailConfirmModalProps = {
  open: boolean;
  onCloseAction: () => void;
  onConfirm: (sendEmail: boolean, clientEmail: string) => void;
  /** Pre-filled client email if known */
  defaultEmail?: string;
  /** What is being sent: 'devis' | 'facture' | 'e-facture' | 'lien de partage' */
  documentType: string;
  /** Document identifier (e.g., quote number) */
  documentLabel?: string | null;
  /** Total amount (formatted) */
  totalLabel?: string;
  loading?: boolean;
};

export function EmailConfirmModal(props: EmailConfirmModalProps) {
  const { open, onCloseAction, documentType, documentLabel } = props;
  const docRef = documentLabel ? `${documentType} ${documentLabel}` : documentType;

  return (
    <Modal
      open={open}
      onCloseAction={onCloseAction}
      title={`Envoyer le ${documentType}`}
      description={`Confirmez l'envoi${documentLabel ? ` du ${docRef}` : ''} au client.`}
    >
      {open && <EmailConfirmContent {...props} />}
    </Modal>
  );
}

/** Inner content — mounts fresh each time the modal opens, resetting all local state. */
function EmailConfirmContent({
  onCloseAction,
  onConfirm,
  defaultEmail,
  documentType,
  totalLabel,
  loading,
}: EmailConfirmModalProps) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [wantEmail, setWantEmail] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      {/* Warning banner */}
      <div
        className="flex items-start gap-3 rounded-xl p-3"
        style={{ background: 'var(--surface-hover)' }}
      >
        <AlertTriangle size={18} style={{ color: 'var(--warning, #f59e0b)' }} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {wantEmail
              ? 'Un email sera envoyé au client avec un lien vers le suivi du projet.'
              : `Le ${documentType} sera marqué comme envoyé sans notification email.`}
          </p>
          {totalLabel && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Montant : {totalLabel}
            </p>
          )}
        </div>
      </div>

      {/* Toggle: send email */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wantEmail}
          onChange={(e) => setWantEmail(e.target.checked)}
          className="h-4 w-4 rounded border accent-current"
          style={{ accentColor: 'var(--text-primary)' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          Notifier le client par email
        </span>
      </label>

      {/* Email input */}
      {wantEmail && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Email du client
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@exemple.com"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

      <ModalFooterSticky>
        <Button variant="outline" onClick={onCloseAction} disabled={loading}>
          Annuler
        </Button>
        <Button
          onClick={() => onConfirm(wantEmail, email.trim())}
          disabled={loading || (wantEmail && !email.trim())}
        >
          <Mail size={16} />
          {loading ? 'Envoi...' : wantEmail ? 'Envoyer' : 'Confirmer'}
        </Button>
      </ModalFooterSticky>
    </div>
  );
}
