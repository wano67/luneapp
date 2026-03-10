'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { sanitizeEuroInput, formatCents } from '@/lib/money';
import { computeChargesPatronales, computeNetFromGross, CONTRACT_TYPE_LABELS } from '@/config/taxation';
import type { EmployeeProfile, Member } from './hooks/types';

type Props = {
  employeeModal: Member | null;
  setEmployeeModal: (m: Member | null) => void;
  employeeDraft: EmployeeProfile;
  setEmployeeDraft: React.Dispatch<React.SetStateAction<EmployeeProfile>>;
  actionLoading: boolean;
  saveEmployeeProfile: () => Promise<void>;
};

export function EmployeeProfileModal({
  employeeModal,
  setEmployeeModal,
  employeeDraft,
  setEmployeeDraft,
  actionLoading,
  saveEmployeeProfile,
}: Props) {
  // Compute charges patronales for display
  const grossCentsStr = employeeDraft.grossSalaryCents ?? '';
  const grossEuros = grossCentsStr ? parseFloat(grossCentsStr.replace(',', '.')) * 100 / 100 : 0;
  const chargesDetail = grossEuros > 0 ? computeChargesPatronales(grossEuros) : null;
  const netEstime = grossEuros > 0 ? computeNetFromGross(grossEuros) : 0;
  const coutEmployeur = grossEuros + (chargesDetail?.total ?? 0);

  return (
    <Modal
      open={!!employeeModal}
      onCloseAction={actionLoading ? () => {} : () => setEmployeeModal(null)}
      title="Profil employe"
      description={employeeModal ? `Profil de ${employeeModal.email}` : undefined}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Intitule de poste"
            value={employeeDraft.jobTitle ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, jobTitle: e.target.value }))}
            disabled={actionLoading}
          />
          <Select
            label="Type de contrat"
            value={employeeDraft.contractType ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, contractType: e.target.value }))}
            disabled={actionLoading}
          >
            <option value="">Non renseigne</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            label="Date de debut"
            type="date"
            value={employeeDraft.startDate ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, startDate: e.target.value }))}
            disabled={actionLoading}
          />
          <Input
            label="Date de fin"
            type="date"
            value={employeeDraft.endDate ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, endDate: e.target.value }))}
            disabled={actionLoading}
          />
          <Input
            label="Heures hebdo"
            type="number"
            value={employeeDraft.weeklyHours ?? ''}
            onChange={(e) =>
              setEmployeeDraft((prev) => ({
                ...prev,
                weeklyHours: e.target.value ? Number(e.target.value) : null,
              }))
            }
            disabled={actionLoading}
          />
          <Input
            label="Cout horaire (EUR)"
            type="text"
            inputMode="decimal"
            value={employeeDraft.hourlyCostCents ?? ''}
            onChange={(e) =>
              setEmployeeDraft((prev) => ({
                ...prev,
                hourlyCostCents: sanitizeEuroInput(e.target.value) || '',
              }))
            }
            disabled={actionLoading}
          />
          <Input
            label="Salaire brut mensuel (EUR)"
            type="text"
            inputMode="decimal"
            value={employeeDraft.grossSalaryCents ?? ''}
            onChange={(e) =>
              setEmployeeDraft((prev) => ({
                ...prev,
                grossSalaryCents: sanitizeEuroInput(e.target.value) || '',
              }))
            }
            disabled={actionLoading}
          />
          <Select
            label="Statut"
            value={employeeDraft.status}
            onChange={(e) =>
              setEmployeeDraft((prev) => ({
                ...prev,
                status: e.target.value as 'ACTIVE' | 'INACTIVE',
              }))
            }
            disabled={actionLoading}
          >
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </Select>
        </div>

        {/* Charges patronales estimation */}
        {chargesDetail && grossEuros > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 text-xs text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Estimation charges patronales</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>Maladie</span><span className="text-right">{formatCents(Math.round(chargesDetail.maladie * 100))}</span>
              <span>Vieillesse</span><span className="text-right">{formatCents(Math.round((chargesDetail.vieillessePlafonnee + chargesDetail.vieillesseDeplafonnee) * 100))}</span>
              <span>Retraite comp.</span><span className="text-right">{formatCents(Math.round((chargesDetail.retraiteCompT1 + chargesDetail.retraiteCompT2) * 100))}</span>
              <span>Chomage + AGS</span><span className="text-right">{formatCents(Math.round((chargesDetail.assuranceChomage + chargesDetail.ags) * 100))}</span>
              <span>Accident travail</span><span className="text-right">{formatCents(Math.round(chargesDetail.accidentTravail * 100))}</span>
              <span>Formation + Taxe app.</span><span className="text-right">{formatCents(Math.round((chargesDetail.formationPro + chargesDetail.taxeApprentissage) * 100))}</span>
              <span>Mutuelle</span><span className="text-right">{formatCents(Math.round(chargesDetail.mutuellePatronale * 100))}</span>
            </div>
            <div className="mt-2 border-t border-[var(--border)]/40 pt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-medium">
              <span>Total patronales</span><span className="text-right text-amber-600">{formatCents(Math.round(chargesDetail.total * 100))}</span>
              <span>Cout employeur</span><span className="text-right">{formatCents(Math.round(coutEmployeur * 100))}</span>
              <span>Net estime</span><span className="text-right text-emerald-600">{formatCents(Math.round(netEstime * 100))}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Notes</span>
          <textarea
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-strong)]"
            rows={3}
            value={employeeDraft.notes ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, notes: e.target.value }))}
            disabled={actionLoading}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEmployeeModal(null)} disabled={actionLoading}>
            Annuler
          </Button>
          <Button onClick={() => void saveEmployeeProfile()} disabled={actionLoading}>
            {actionLoading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
