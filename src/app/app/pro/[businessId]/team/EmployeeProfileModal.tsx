'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { sanitizeEuroInput } from '@/lib/money';
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
  return (
    <Modal
      open={!!employeeModal}
      onCloseAction={actionLoading ? () => {} : () => setEmployeeModal(null)}
      title="Profil employé"
      description={employeeModal ? `Profil de ${employeeModal.email}` : undefined}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Intitulé de poste"
            value={employeeDraft.jobTitle ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, jobTitle: e.target.value }))}
            disabled={actionLoading}
          />
          <Input
            label="Type de contrat"
            value={employeeDraft.contractType ?? ''}
            onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, contractType: e.target.value }))}
            disabled={actionLoading}
          />
          <Input
            label="Date de début"
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
            label="Coût horaire (€)"
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
            {actionLoading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
