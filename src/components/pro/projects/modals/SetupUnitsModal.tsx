"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import type { SetupUnitsModalProps } from './setup-types';

export default function SetupUnitsModal({
  isAdmin,
  organizationUnits,
  unitDraftName,
  unitDraftOrder,
  unitErrors,
  teamInfo,
  unitDrafts,
  members,
  setUnitDraftName,
  setUnitDraftOrder,
  setUnitDrafts,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
  onAssignMemberToUnit,
  onCloseUnitsModal,
}: SetupUnitsModalProps) {
  return (
    <Modal
      open
      onCloseAction={onCloseUnitsModal}
      title="Gérer les pôles"
      description="Créez des pôles et assignez les membres."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Nouveau pôle</p>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <Input
              placeholder="Nom du pôle"
              value={unitDraftName}
              onChange={(e) => setUnitDraftName(e.target.value)}
            />
            <Input
              placeholder="Ordre"
              type="number"
              value={unitDraftOrder}
              onChange={(e) => setUnitDraftOrder(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={onCreateUnit} disabled={!isAdmin}>
            Ajouter
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Pôles existants</p>
          {organizationUnits.length ? (
            <div className="space-y-2">
              {organizationUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
                    <Input
                      value={unitDrafts[unit.id]?.name ?? unit.name}
                      onChange={(e) =>
                        setUnitDrafts((prev) => ({
                          ...prev,
                          [unit.id]: {
                            name: e.target.value,
                            order: prev[unit.id]?.order ?? String(unit.order),
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={unitDrafts[unit.id]?.order ?? String(unit.order)}
                      onChange={(e) =>
                        setUnitDrafts((prev) => ({
                          ...prev,
                          [unit.id]: {
                            name: prev[unit.id]?.name ?? unit.name,
                            order: e.target.value,
                          },
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateUnit(unit.id)}
                      disabled={!isAdmin}
                    >
                      Enregistrer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteUnit(unit.id)}
                      disabled={!isAdmin}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Aucun pôle créé.</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Assigner les membres</p>
          {members.map((member) => (
            <div
              key={member.membershipId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
            >
              <span className="text-sm text-[var(--text-primary)]">
                {member.name ?? member.email}
              </span>
              <Select
                value={member.organizationUnit?.id ?? ''}
                onChange={(e) => onAssignMemberToUnit(member.membershipId, e.target.value || null)}
                disabled={!isAdmin}
              >
                <option value="">Sans pôle</option>
                {organizationUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        {unitErrors ? <p className="text-sm text-[var(--danger)]">{unitErrors}</p> : null}
        {teamInfo ? <p className="text-sm text-[var(--success)]">{teamInfo}</p> : null}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCloseUnitsModal}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
